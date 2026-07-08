"""GIS feature service."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.init_db import asset_to_dict, is_db_ready
from app.models import Asset
from app.services.asset_service import list_assets


async def get_features(
    session: AsyncSession | None,
    *,
    layer: str | None = None,
    bbox: str | None = None,
    asset_type: str | None = None,
) -> dict:
    items, total = await list_assets(
        session, asset_type=asset_type, page=1, page_size=2000
    )

    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(v) for v in bbox.split(",")]
            items = [
                a
                for a in items
                if a.get("latitude") is not None
                and min_lat <= a["latitude"] <= max_lat
                and min_lon <= a["longitude"] <= max_lon
            ]
        except (ValueError, TypeError):
            pass

    features = []
    for a in items:
        if layer == "lines" and a.get("asset_type") != "line":
            continue
        if layer == "towers" and a.get("asset_type") != "tower":
            continue
        if layer == "substations" and a.get("asset_type") != "substation":
            continue

        geom = a.get("geometry")
        if not geom and a.get("latitude") is not None:
            geom = {"type": "Point", "coordinates": [a["longitude"], a["latitude"]]}

        features.append(
            {
                "type": "Feature",
                "id": a["id"],
                "geometry": geom,
                "properties": {
                    "asset_id": a["id"],
                    "asset_code": a.get("asset_code", a["name"]),
                    "name": a["name"],
                    "asset_type": a["asset_type"],
                    "status": a.get("status"),
                    "criticality": a.get("criticality"),
                    "health_score": a.get("health_score"),
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "total": len(features),
        "layers": ["lines", "towers", "substations", "all"],
    }


async def proximity_analysis(
    session: AsyncSession | None,
    *,
    center_lat: float,
    center_lon: float,
    radius_km: float = 5.0,
    asset_types: list[str] | None = None,
) -> dict:
    items, _ = await list_assets(session, page=1, page_size=2000)
    results = []

    for a in items:
        lat, lon = a.get("latitude"), a.get("longitude")
        if lat is None or lon is None:
            continue
        if asset_types and a.get("asset_type") not in asset_types:
            continue
        # Haversine approximation
        dlat = (lat - center_lat) * 111.0
        dlon = (lon - center_lon) * 111.0 * max(0.1, abs(center_lat))
        dist_km = (dlat**2 + dlon**2) ** 0.5
        if dist_km <= radius_km:
            results.append({**a, "distance_km": round(dist_km, 2)})

    results.sort(key=lambda x: x["distance_km"])
    return {
        "center": {"lat": center_lat, "lon": center_lon},
        "radius_km": radius_km,
        "count": len(results),
        "assets": results,
    }

# TAMS Phase 1 MVP — Implementation Guide

This document describes what was implemented from the [enterprise documentation](./enterprise/README.md).

## What Was Built

### Backend (FastAPI + PostgreSQL)

| Module | Endpoints | Status |
|--------|-----------|--------|
| **Asset Registry** | `GET/POST/PUT/DELETE /assets`, `/assets/{id}/hierarchy`, `/assets/{id}/qr` | ✅ |
| **Alarms** | `GET/POST /alarms`, `/alarms/summary`, acknowledge, close | ✅ |
| **Legacy Alerts** | `GET/PATCH /alerts` (backward compatible) | ✅ |
| **Health** | `GET /health`, `/health/assets/{id}` | ✅ |
| **Work Orders** | `GET/POST /workorders`, `/maintenance/assets/{id}/history` | ✅ |
| **Inspections** | `GET/POST /inspections`, `/inspections/{id}/analyze` | ✅ |
| **GIS** | `GET /gis/layers`, `/gis/features`, `POST /gis/analytics/proximity` | ✅ |
| **Dashboards** | `/dashboard/operations`, `/maintenance`, `/executive` | ✅ |
| **Analytics** | `/analytics/overview`, `/analytics/risk` | ✅ |
| **Predictive** | `/predictive/recommendations` | ✅ (heuristic) |
| **Risk** | `/risk` | ✅ |
| **Satellite Monitoring** | Existing `/monitoring/*`, `/imagery/*` | ✅ preserved |

### Database (PostgreSQL + PostGIS)

Tables created on startup when DB is available:

- `asset_types`, `substations`, `assets`, `sensors`
- `alarms`, `health_scores`, `work_orders`, `inspections`
- `users`, `roles`, `user_roles`, `audit_logs`

Auto-seeds from existing mock catalog on first run (~56 assets, alarms, work orders, inspections).

**Fallback:** If PostgreSQL is unavailable, all APIs use in-memory mock data (Railway deploy without DB).

### Frontend (React + Material UI)

| Page | Route | Description |
|------|-------|-------------|
| GIS Command Center | `/` | Existing map + LeftSidebar/RightSidebar + satellite dashboard |
| Operations Dashboard | `/dashboard` | KPIs, alarms, reliability metrics |
| Asset Registry | `/assets` | Search, list, create assets |
| Alarm Center | `/alarms` | Severity view, acknowledge |
| Condition Monitoring | `/health` | Portfolio health, risk ranking |
| Maintenance Center | `/maintenance` | Work order queue |
| Inspection Portal | `/inspections` | Inspection records |
| Analytics | `/analytics` | Overview + predictive recommendations |
| Satellite Monitoring | `/monitoring` | Pipeline workflow UI |

## Quick Start

### With Docker (full stack + database)

```bash
docker-compose up -d postgres
cd backend
pip install -r requirements.txt
# Set DATABASE_URL in backend/.env:
# postgresql+asyncpg://tams_user:tams_password@localhost:5432/tams_db
python -m uvicorn app.main:app --reload --port 8000

cd frontend
npm install
npm run dev
```

### Without database (mock mode)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

API status: `GET http://localhost:8000/api/v1/status` → `"database": false` in mock mode.

## Architecture Notes

- **Current stack:** FastAPI + PostgreSQL (Phase 1 prototype path)
- **Target stack (enterprise docs):** .NET 8 + Azure SQL + ADX (Phase 2+ migration)
- Enterprise API spec in `docs/enterprise/05-API-SPECIFICATION.md` is implemented in FastAPI for rapid MVP delivery

## Next Steps (Phase 2)

1. SCADA/IoT ingestion via Azure IoT Hub (or local MQTT adapter)
2. Azure AD authentication + RBAC middleware
3. SignalR live sensor updates
4. .NET 8 microservices migration (parallel track)
5. Mobile app (React Native)

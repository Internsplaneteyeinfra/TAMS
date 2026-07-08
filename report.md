# TAMS Project Overview & Documentation Report

This document provides a comprehensive business-level and technical-level overview of **TAMS** (Transmission Asset Monitoring System), details all current API routes, and maps out the function of every file in the project.

---

## 1. Business Level Value & Overview

### The Core Problem
Electrical transmission grids span thousands of kilometers across rugged, remote terrains. Monitoring these high-voltage lines, transmission towers, and substations is critical for grid stability. Traditional methods are:
*   **Slow & Costly:** Ground patrols or helicopter flights take weeks or months to cover whole networks and are highly expensive.
*   **Reactive:** Utilities often discover vegetation overgrowth or hardware degradation only *after* a power outage, wildfire, or catastrophic equipment failure occurs.

### The TAMS Solution
TAMS is an **AI-powered Transmission Asset Monitoring System** that automates corridor inspection by combining:
1.  **Earth Observation & Satellite Data Fusion:** Acquires optical, SAR (Radar), and night thermal imagery from satellites like Sentinel-1, Sentinel-2, and Landsat 9.
2.  **Computer Vision & AI:** Automatically detects structures (YOLOv11), segments vegetation boundaries (U-Net), and checks for thermal anomalies (Autoencoders).
3.  **Command Center UI:** Integrates maps, alerts, and analytics dashboards to notify operators in real time.

### Business Benefits
*   **Reduced Outages:** Prevents ground faults and short-circuits caused by vegetation encroachment (trees touching conductors) and structural degradation.
*   **Optimized O&M Costs:** Guides maintenance crews directly to high-risk zones, eliminating unnecessary periodic physical patrols.
*   **Wildfire & Disaster Mitigation:** Early thermal hotspot detection and weather threat analysis prevent grid-initiated wildfires.

---

## 2. Technical Architecture & Stack

TAMS is organized as a decoupled microservices/monorepo structure:

```
┌─────────────────────────────────────────────────────────────┐
│           GIS Command Center (React/Next.js)                │
│         - Interactive Map (Mapbox/Leaflet)                  │
│         - Dashboard & Alerts                                │
│         - Real-time Visualization                           │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────▼────────────┐
        │   API Layer         │
        │ (FastAPI/GraphQL)   │
        └────────┬────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
  Core      Feature      Alert
  Services  Extraction   Engine
    │            │            │
    └────────────┼────────────┘
                 │
    ┌────────────▼──────────────┐
    │  Data & Processing Layer  │
    ├─ Satellite Ingestion      │
    ├─ EO Processing Pipeline   │
    ├─ Feature Extraction       │
    └────────────┬──────────────┘
                 │
    ┌────────────▼──────────────┐
    │   Storage Layer           │
    ├─ S3 (Imagery)             │
    ├─ PostgreSQL+PostGIS       │
    ├─ TimescaleDB              │
    └───────────────────────────┘
```

### The Technology Stack
*   **Frontend Command Center:** Built with [Next.js 14](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend), TypeScript, Leaflet/Cesium (map visualization), Material UI v5 (enterprise module pages), Redux Toolkit, Tailwind CSS, and React Query.
*   **Backend Application:** Implemented with [FastAPI](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend) (Python 3.11+). Runs asynchronously and uses Pydantic schemas for request/response serialization.
*   **AI/ML Models:** Built on PyTorch and Ultralytics (YOLO) located inside the [ml](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/ml) folder.
*   **Storage Systems:** Uses PostgreSQL with PostGIS extension for spatial queries, TimescaleDB for telemetry/sensor time-series logs, Redis for caching, and AWS S3 for hosting heavy GeoTIFF imagery.

---

## 3. Core Monitoring Workflow Pipeline

The core intelligence in TAMS runs through an automated 5-stage orchestration pipeline defined in [monitoring_workflow.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/monitoring_workflow.py):

1.  **Acquire (Satellite Data Acquisition):** Queries SpatioTemporal Asset Catalog (STAC) APIs for selected bounding boxes to find the latest Sentinel/Landsat scenes.
2.  **Detect (Computer Vision Analysis):** Run inference on images. Uses YOLOv11 to confirm tower positions, U-Net to segment vegetation boundaries, and Autoencoders to find thermal anomalies.
3.  **Compare (Historical Change Detection):** Compares current detections against a baseline database to detect new construction, missing towers, or accelerating vegetation growth.
4.  **Alert (Priority Engine):** Triggers alerts if vegetation clearance drops below a safety threshold (e.g., < 5 meters) or if a thermal anomaly is confirmed.
5.  **Complete (Actionable Dispatch):** Updates the GIS dashboard and dispatches work orders to maintenance teams.

---

## 4. Complete Route-by-Route API Reference

All backend routes are registered in [backend/app/api/v1/__init__.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/__init__.py). Here is what each route does:

### 1. System Status
*   **`GET /api/v1/status`**
    *   **File:** [backend/app/api/v1/__init__.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/__init__.py)
    *   **Description:** Returns the API operational status, version details, current phase, and available satellite ingestion capabilities.

### 2. Asset Management
*   **`GET /api/v1/assets`**
    *   **File:** [backend/app/api/v1/assets.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/assets.py)
    *   **Parameters:** `asset_type` (Optional), `page` (Default: 1), `page_size` (Default: 100)
    *   **Description:** Lists all registered transmission assets (substations, lines, towers) with pagination and optional type filtering.
*   **`GET /api/v1/assets/{asset_id}`**
    *   **File:** [backend/app/api/v1/assets.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/assets.py)
    *   **Description:** Retrieves metadata, status, health score, coordinates, and physical properties of a single asset by its ID.
*   **`POST /api/v1/assets`**
    *   **File:** [backend/app/api/v1/assets.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/assets.py)
    *   **Request Body:** `AssetCreate` (JSON payload)
    *   **Description:** Creates and saves a new transmission asset in the system database.

### 3. Alert Management
*   **`GET /api/v1/alerts`**
    *   **File:** [backend/app/api/v1/alerts.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/alerts.py)
    *   **Parameters:** `status` (Optional), `priority` (Optional)
    *   **Description:** Returns a list of active alerts filtered by status (open, acknowledged) or priority (critical, high, medium, low).
*   **`PATCH /api/v1/alerts/{alert_id}/acknowledge`**
    *   **File:** [backend/app/api/v1/alerts.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/alerts.py)
    *   **Description:** Marks an active alert as acknowledged, updating `acknowledged_at` timestamps for auditing.

### 4. Satellite Imagery Services
*   **`GET /api/v1/imagery/night/catalog`**
    *   **File:** [backend/app/api/v1/imagery.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/imagery.py)
    *   **Parameters:** `bbox` (minLon, minLat, maxLon, maxLat), `datetime_from`, `datetime_to`
    *   **Description:** Searches Sentinel-2A night-time acquisition campaign scenes for thermal intelligence over specific coordinates.
*   **`GET /api/v1/imagery/night/access`**
    *   **File:** [backend/app/api/v1/imagery.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/imagery.py)
    *   **Description:** Returns credentials and endpoints to pull raw/processed night data from Copernicus Data Space (CDSE) S3 bucket.
*   **`GET /api/v1/imagery/night/pipeline`**
    *   **File:** [backend/app/api/v1/imagery.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/imagery.py)
    *   **Description:** Returns orthorectification processing pipeline steps (L1B calibration, GDAL warping, Sen2VM execution parameters).

### 5. Automated Monitoring Orchestration
*   **`GET /api/v1/monitoring/workflow`**
    *   **File:** [backend/app/api/v1/monitoring.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/monitoring.py)
    *   **Description:** Gets the schema mapping of all pipeline stages, satellite modalities, target detections, and alert thresholds.
*   **`POST /api/v1/monitoring/run`**
    *   **File:** [backend/app/api/v1/monitoring.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/monitoring.py)
    *   **Request Body:** `MonitoringRunRequest` (BBox, sources, generate_alerts boolean)
    *   **Description:** Triggers a live cycle monitoring run for the requested assets and bbox.
*   **`GET /api/v1/monitoring/runs`**
    *   **File:** [backend/app/api/v1/monitoring.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/monitoring.py)
    *   **Description:** Returns execution logs and result parameters of past monitoring runs.
*   **`GET /api/v1/monitoring/runs/{run_id}`**
    *   **File:** [backend/app/api/v1/monitoring.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/monitoring.py)
    *   **Description:** Fetches step-by-step logs and AI outputs for a specific cycle run ID.

### 6. Command Center Analytics
*   **`GET /api/v1/analytics/overview`**
    *   **File:** [backend/app/api/v1/analytics.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/analytics.py)
    *   **Description:** Compiles network statistics (total assets, assets by type, health index, open alerts) for the Executive Dashboard.
*   **`GET /api/v1/analytics/risk`**
    *   **File:** [backend/app/api/v1/analytics.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/analytics.py)
    *   **Description:** Provides risk intelligence assessment including overall regional scores, wildfire risk index, and 90-day outage probabilities.

### 7. Enterprise Modules (Alarms, Health, Maintenance, GIS, Dashboards)

| Route prefix | File | Description |
|--------------|------|-------------|
| `/api/v1/alarms` | `alarms.py` | Alarm lifecycle — list, create, acknowledge, close, summary |
| `/api/v1/health` | `health.py` | Portfolio and per-asset condition scores |
| `/api/v1/workorders` | `workorders.py` | Maintenance work order queue and history |
| `/api/v1/inspections` | `inspections.py` | Inspection records and analysis |
| `/api/v1/gis/*` | `gis.py` | GeoJSON features, layers, proximity analytics |
| `/api/v1/dashboard/*` | `dashboard.py` | Role-based KPI dashboards (operations, maintenance, executive) |
| `/api/v1/predictive/*` | `predictive.py` | Heuristic maintenance recommendations |
| `/api/v1/risk` | `risk.py` | Aggregated risk scores |

Full endpoint list: [docs/enterprise/IMPLEMENTATION.md](docs/enterprise/IMPLEMENTATION.md) and OpenAPI at `/docs`.

---

## 5. Directory Structure & File Map

Here is the file-by-file map explaining what every component does in the project.

### Core Configuration Files
*   [package.json](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/package.json): Root node project configuration. Defines commands to run both frontend and backend concurrently in development mode.
*   [docker-compose.yml](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/docker-compose.yml): Spins up the complete platform stack (Postgres DB + PostGIS, Redis, FastAPI Backend, Next.js Frontend).
*   [README.md](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/README.md): Developer onboarding documentation, architecture overview, and deployment scripts.

### 1. Backend Service (`/backend`)
*   [backend/app/main.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/main.py): Initializes the FastAPI instance, injects CORS policies, starts global logger, and exposes roots.
*   **`backend/app/core/`**
    *   [config.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/core/config.py): Reads environment parameters (DB connection URLs, JWT secrets, CDSE S3 keys) using `PydanticBaseSettings`.
    *   [logging.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/core/logging.py): Standardizes JSON logging for application events and errors.
*   **`backend/app/db/`**
    *   [database.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/db/database.py): Configures SQLAlchemy engine, connection pools, and database sessions.
*   **`backend/app/models/`**
    *   [entities.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/models/entities.py): SQLAlchemy models — assets, substations, alarms, health scores, work orders, inspections, users/roles, audit logs.
*   **`backend/app/schemas/`**
    *   [asset.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/schemas/asset.py): Pydantic validation structures for asset creation and serialization.
    *   [imagery.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/schemas/imagery.py): Types and schemas for satellite products (orthorectified geotiff, raw L1B).
    *   [monitoring.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/schemas/monitoring.py): Schemas defining monitoring request, stage results, and detection metadata.
    *   [response.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/schemas/response.py): Wraps all API responses in a unified meta-envelope format.
*   **`backend/app/services/`**
    *   [monitoring_workflow.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/monitoring_workflow.py): Coordinates the Acquire -> Detect -> Compare -> Alert sequence.
    *   [mock_data.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/mock_data.py): Provides mock records to run Phase-1 frontend interactions without requiring a live Postgres instance.
    *   [substation_catalog.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/substation_catalog.py): Coordinates of major national grid substations (emphasizing Indian POWERGRID nodes like Kalwa 400kV, Chakan 400kV, Nelamangala 765kV) and world nodes.
    *   [sentinel2_night.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/sentinel2_night.py): Queries CDSE catalogue for specialized Sentinel-2 night thermal campaigns.
    *   [stac_catalog.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/stac_catalog.py): Interacts with external SpatioTemporal Asset Catalog endpoints to find Sentinel-1, Sentinel-2, and Landsat 9 metadata.
    *   [change_detection.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/change_detection.py): Logic comparing current detections against historical properties to calculate changes.
    *   [alert_engine.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/alert_engine.py): Generates active alerts based on clearance violations or structural anomalies.

### 2. Frontend GIS Command Center (`/frontend`)

*   **`frontend/src/pages/`**
    *   [\_app.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/pages/_app.tsx): Global providers (Redux, React Query) and styles.
    *   [index.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/pages/index.tsx): GIS Command Center home — map viewport with left/right sidebars.
    *   **MUI module pages** (client-only SSR): `/dashboard`, `/assets`, `/alarms`, `/health`, `/maintenance`, `/inspections`, `/analytics`, `/monitoring`.
*   **`frontend/src/components/`**
    *   [LeftSidebar.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/components/LeftSidebar.tsx): Navigation, asset filters, monitoring controls, alert summaries.
    *   [RightSidebar.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/components/RightSidebar.tsx): Asset detail panel, health metrics, quick actions.
    *   [MapViewport.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/components/MapViewport.tsx): Map container orchestrating 2D/3D views.
    *   [GISMap.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/components/GISMap.tsx): Leaflet map — towers, substations, lines, health styling, layer switching.
    *   [MonitoringWorkflow.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/components/MonitoringWorkflow.tsx): Satellite pipeline status and run trigger.
    *   [layout/AppLayout.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/components/layout/AppLayout.tsx): MUI shell for enterprise module pages.
*   **`frontend/src/lib/`**
    *   [api.ts](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/lib/api.ts): Wraps fetch requests with default headers and base URL configuration.
    *   [store.ts](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/lib/store.ts): Configures Redux store to manage current selected asset ID and map zoom coordinates.

### 3. ML Models (`/ml`)
*   [ml/models/\_\_init\_\_.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/ml/models/__init__.py): Defines three PyTorch/Ultralytics wrapper classes:
    *   `TowerDetector`: YOLOv11m models to isolate lattice/monopole coordinates in imagery.
    *   `VegetationMonitor`: U-Net models for corridor vegetation classification.
    *   `ThermalAnomalyDetector`: Autoencoder network to compute pixel-level thermal deviations in night bands.

---

## 6. Feature-by-Feature Deep Dive: Business & Tech Levels

This section breaks down the specific capabilities of TAMS across both the Business perspective and Technical execution levels.

### A. Satellite Imagery Ingestion (Acquisition)
*   **Business Level (Why & Value):**
    *   Provides continuous, automated wide-area monitoring without human risk or logistical overhead.
    *   Saves millions of dollars in helicopter/ground patrols by prioritizing maintenance dispatches only where satellite scenes indicate anomalies.
*   **Technical Level (Flow & Implementation):**
    *   Triggered via the `/api/v1/imagery` router in [imagery.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/api/v1/imagery.py).
    *   The orchestration is handled in [stac_catalog.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/stac_catalog.py), which queries external SpatioTemporal Asset Catalog APIs using structured bounding boxes and uploads GeoTIFF arrays to AWS S3.

### B. Asset Detection & Mapping (Computer Vision)
*   **Business Level (Why & Value):**
    *   Automatically validates the geometry of physical assets (towers, substations) and registers new utility infrastructure automatically.
    *   Ensures the digital inventory (GIS Command Center) matches real-world spatial locations.
*   **Technical Level (Flow & Implementation):**
    *   Executed using the `TowerDetector` class in [ml/models/\_\_init\_\_.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/ml/models/__init__.py).
    *   Uses PyTorch and Ultralytics YOLOv11 to run bounding box regression and classification on incoming optical bands, returning coordinate matrices and confidence scores.

### C. Vegetation & Corridor Encroachment Monitoring
*   **Business Level (Why & Value):**
    *   Trees and vegetation growing too close to transmission lines are a leading cause of grid-initiated fires and power outages.
    *   Allows operations teams to perform target-trimming in high-risk zones, avoiding costly generalized clearing operations.
*   **Technical Level (Flow & Implementation):**
    *   Managed by the `VegetationMonitor` class in [ml/models/\_\_init\_\_.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/ml/models/__init__.py).
    *   Involves semantic segmentation using a U-Net architecture. Pixels matching vegetation profiles inside the transmission Right of Way (ROW) corridor are flagged, and clearance margins are calculated in meters.

### D. Thermal Hotspot & Night Monitoring
*   **Business Level (Why & Value):**
    *   Overloaded transformers and degrading grid connections emit heat before they fail.
    *   Using night-time thermal sensors allows the utility to check grid loads under peak conditions without daytime atmospheric solar reflection interfering with readings.
*   **Technical Level (Flow & Implementation):**
    *   Uses specialized Sentinel-2 Night Acquisition datasets parsed through [sentinel2_night.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/sentinel2_night.py).
    *   Applies a PyTorch Autoencoder in [ml/models/\_\_init\_\_.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/ml/models/__init__.py) to calculate pixel-level reconstruction error. Higher reconstruction loss signals a thermal anomaly, triggering high-priority alerts.

### E. Change Detection & Temporal Analysis
*   **Business Level (Why & Value):**
    *   Identifies new construction, ground displacement (landslides), or flooding adjacent to transmission towers over time.
    *   Allows structural engineers to address foundation threats before a tower falls.
*   **Technical Level (Flow & Implementation):**
    *   Implemented within [change_detection.py](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/backend/app/services/change_detection.py).
    *   Applies spatial overlay matrices to compare old visual features (baseline) with recent observations. Differences are calculated as change polygons.

### F. Interactive GIS Command Center Map
*   **Business Level (Why & Value):**
    *   A single pane of glass for dispatcher, maintenance directors, and grid operators.
    *   Shows clear status displays and geographical context to quickly mobilize crews during crisis events.
*   **Technical Level (Flow & Implementation):**
    *   Developed in [GISMap.tsx](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/components/GISMap.tsx) using Leaflet and Custom SVG layer icons.
    *   Synchronizes active clicks and selected towers globally through Redux Toolkit [store.ts](file:///c:/Users/shivam.nikam/Desktop/Full%20stack/TAMS/frontend/src/lib/store.ts) and triggers lazy load tile layers (Satellite Imagery maps and street layers) on demand.


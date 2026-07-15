# TAMS — Transmission Asset Monitoring System

## Overview

**TAMS** (Transmission Asset Monitoring System) is an enterprise digital platform for electric power transmission utilities. It combines Earth Observation, satellite monitoring, GIS visualization, asset registry, condition monitoring, alarm management, maintenance workflows, and predictive analytics.

> **Naming note:** Older docs may refer to *Transmission Asset Intelligence & Monitoring Platform* — the official product name is **Transmission Asset Monitoring System (TAMS)** per [docs/enterprise/01-BRD.md](./docs/enterprise/01-BRD.md).

**Current release:** Phase 1 MVP — Satellite monitoring + enterprise asset modules (FastAPI + PostgreSQL prototype; Azure/.NET target documented in [docs/enterprise/](./docs/enterprise/README.md)).

## Repositories

| Part | GitHub |
|------|--------|
| **Frontend (this repo)** | https://github.com/vishalbhor-45/TAMS |
| **Backend (API + KML)** | https://github.com/planeteyeai/TAMS-Backend |

Clone the backend next to this repo for local `run.ps1` / Docker:

```bash
git clone https://github.com/planeteyeai/TAMS-Backend.git ../TAMS-Backend
# or from this repo:
npm run link:backend
```

**How they connect locally**

| Side | URL | Role |
|------|-----|------|
| Frontend | http://localhost:3000 | Next.js UI |
| Backend | http://127.0.0.1:8000 | FastAPI + Gujarat KML |
| Bridge | `BACKEND_URL` in `frontend/.env` | Next rewrites `/api/*` → backend |

Start both: `npm run dev:stack` (or `.\run.ps1`). Frontend alone: `npm run dev` (backend must already be on :8000).

**Hosted**

| App | Platform | Repo |
|-----|----------|------|
| Frontend website | [Render](https://render.com) (`render.yaml`, rootDir `frontend`) | this repo |
| Backend API | [Railway](https://railway.app) (`Dockerfile` + `railway.json`) | [TAMS-Backend](https://github.com/planeteyeai/TAMS-Backend) |

After both are live, set on Render:

- `BACKEND_URL=https://YOUR-SERVICE.up.railway.app`
- `NEXT_PUBLIC_HOSTED_API_BASE_URL=https://YOUR-SERVICE.up.railway.app/api/v1`

On Railway set `CORS_ORIGINS` to include your Render URL (e.g. `https://tams-frontend.onrender.com`).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           GIS Command Center (React/Next.js)                │
│         - Interactive Map (Mapbox/CesiumJS)                │
│         - Dashboard & Alerts                               │
│         - Real-time Visualization                          │
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
    │   Storage Layer (AWS)     │
    ├─ S3 (Imagery)             │
    ├─ PostgreSQL+PostGIS       │
    ├─ TimescaleDB              │
    └───────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React, Next.js 14+ (Pages Router)
- **Language**: TypeScript
- **Map Visualization**: Leaflet, CesiumJS, Esri tiles
- **Enterprise UI**: Material UI v5 (module pages: `/dashboard`, `/assets`, `/alarms`, etc.)
- **GIS Command Center**: `LeftSidebar`, `RightSidebar`, `MapViewport`, `GISMap`
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS + MUI theme
- **Testing**: Vitest, Playwright

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **API Standards**: REST (OpenAPI at `/docs`)
- **Database**: PostgreSQL + PostGIS (SQLAlchemy async; mock fallback when DB unavailable)
- **Cache**: Redis (Docker Compose)
- **Task Queue**: Celery + Redis (planned)

### AI/ML
- **Computer Vision**: PyTorch, TensorFlow
- **Models**: YOLOv11, U-Net, ViT, Autoencoder
- **Feature Engineering**: Scikit-learn, GeoPandas
- **Model Registry**: MLflow

### Infrastructure
- **Local**: Docker Compose (PostgreSQL, Redis, backend, frontend)
- **Prototype cloud**: Railway / Render (backend), optional AWS Terraform scaffold
- **Target production**: Microsoft Azure — see [docs/enterprise/07-AZURE-DEPLOYMENT.md](./docs/enterprise/07-AZURE-DEPLOYMENT.md)
- **Containerization**: Docker
- **Orchestration**: Kubernetes manifests (dev/prod)
- **CI/CD**: GitHub Actions

## Project Structure

```
tams/
├── frontend/              # Next.js GIS Command Center
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── styles/
│   ├── public/
│   └── package.json
├── backend/               # FastAPI Backend
│   ├── app/
│   │   ├── api/           # Route handlers
│   │   ├── services/      # Business logic
│   │   ├── models/        # ORM models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── db/            # Database config
│   ├── requirements.txt
│   └── main.py
├── ml/                    # ML Models & Pipelines
│   ├── models/
│   │   ├── tower_detection/
│   │   ├── vegetation_monitoring/
│   │   └── thermal_anomaly/
│   ├── pipelines/
│   └── requirements.txt
├── data/                  # Data schemas & migrations
│   ├── schemas/
│   └── migrations/
├── infrastructure/        # IaC & K8s configs
│   ├── terraform/
│   └── kubernetes/
├── docker/                # Docker configurations
│   ├── backend/Dockerfile
│   ├── frontend/Dockerfile
│   └── docker-compose.yml
├── tests/                 # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                  # Documentation
├── config/                # Configuration files
└── package.json
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Git
- AWS CLI configured

### Development Setup

#### 1. Clone and Install
```bash
git clone <repository>
cd tams
npm install
```

#### 2. Environment Setup
```bash
# Frontend
cp frontend/.env.example frontend/.env.local

# Backend
cp backend/.env.example backend/.env
```

#### 3. Start Services
```bash
# All services with Docker Compose
docker-compose up -d

# Or run locally (requires local PostgreSQL, Redis, etc.)
npm run dev
```

#### 4. Access Applications
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- GraphQL: http://localhost:8000/graphql

## Phase 1 Features

### Data Ingestion
- [x] Satellite data ingestion from STAC APIs
- [x] Automated download and validation
- [x] Metadata extraction and cataloging

### GIS Command Center
- [x] Interactive map with Mapbox
- [x] Asset layer visualization (towers, lines, substations)
- [x] Risk zone display
- [x] Real-time alerts

### Feature Extraction
- [x] Tower detection (YOLOv11)
- [x] Corridor segmentation (U-Net)
- [x] Vegetation monitoring

### Anomaly Detection
- [x] Thermal hotspot detection (Autoencoder)
- [x] Encroachment detection
- [x] Risk scoring

### Data Management
- [x] PostgreSQL with PostGIS
- [x] S3-based imagery storage
- [x] TimescaleDB for time-series data

## API Endpoints

See [docs/API.md](./docs/API.md) and the full [Enterprise API Specification](./docs/enterprise/05-API-SPECIFICATION.md).

### Core modules (implemented)
```
GET/POST/PUT/DELETE  /api/v1/assets              # Asset registry
GET/POST             /api/v1/alarms              # Alarm management
GET/PATCH            /api/v1/alerts              # Legacy alerts (compat)
GET                  /api/v1/health               # Condition monitoring
GET/POST             /api/v1/workorders           # Maintenance
GET/POST             /api/v1/inspections         # Inspections
GET                  /api/v1/gis/features         # GIS GeoJSON
GET                  /api/v1/dashboard/*          # Role dashboards
GET                  /api/v1/analytics/*          # Analytics & risk
GET                  /api/v1/predictive/*         # Recommendations (heuristic)
POST                 /api/v1/monitoring/run        # Satellite pipeline
GET                  /api/v1/imagery/night/*       # Sentinel-2 night imagery
```

## Deployment

### Local Development
```bash
docker-compose -f docker-compose.dev.yml up
```

### AWS Deployment
```bash
# Build and push Docker images
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t tams-backend:latest ./backend
docker tag tams-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/tams-backend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/tams-backend:latest

# Deploy via Terraform
cd infrastructure/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

### Kubernetes Deployment
```bash
kubectl apply -f infrastructure/kubernetes/dev/
# or for production
kubectl apply -f infrastructure/kubernetes/prod/
```

## Testing

```bash
# Run all tests
npm run test

# Frontend tests
npm run test:frontend

# Backend tests
npm run test:backend

# With coverage
cd backend && pytest --cov=app

# E2E tests
npm run test:e2e
```

## Documentation

### Project guides
- [Architecture](./docs/ARCHITECTURE.md) — Current FastAPI/Next.js architecture
- [API Reference](./docs/API.md) — REST endpoints (summary)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Setup Summary](./SETUP_SUMMARY.md)
- [Implementation Status](./docs/enterprise/IMPLEMENTATION.md)

### Enterprise design (BRD, SRS, Azure, security)
- [Enterprise Documentation Index](./docs/enterprise/README.md)

## Contributing

1. Create feature branch: `git checkout -b feature/component-name`
2. Commit changes: `git commit -m 'Add feature description'`
3. Push to branch: `git push origin feature/component-name`
4. Submit pull request

## License

Proprietary — Transmission Asset Monitoring System (TAMS)

## Contact

For support and questions, contact: support@tams.io

---

**Current Phase**: 1 — MVP (Satellite + Asset Registry + GIS + Alarms + Health + Maintenance)  
**Next Phase**: 2 — SCADA/IoT real-time ingestion, Azure AD, SignalR  
**Roadmap**: [docs/enterprise/09-IMPLEMENTATION-PLAN.md](./docs/enterprise/09-IMPLEMENTATION-PLAN.md)

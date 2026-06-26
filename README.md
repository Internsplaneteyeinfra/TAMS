# TAMS - Transmission Asset Intelligence & Monitoring Platform

## Overview

TAMS is an AI-powered Transmission Asset Intelligence Platform that combines Earth Observation, Satellite Data Fusion, SCADA, PMU, Weather Intelligence, and Predictive Analytics to deliver proactive monitoring of high-voltage transmission networks.

**Phase 1: Satellite Monitoring Platform** - Foundation for satellite data ingestion, processing, GIS visualization, and AI-powered anomaly detection.

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
- **Framework**: React, Next.js 14+
- **Language**: TypeScript
- **Map Visualization**: Mapbox GL, CesiumJS
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **Testing**: Jest, Playwright

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **API Standards**: REST + GraphQL
- **Database**: PostgreSQL + PostGIS
- **Time-Series DB**: TimescaleDB
- **Cache**: Redis
- **Task Queue**: Celery + Redis

### AI/ML
- **Computer Vision**: PyTorch, TensorFlow
- **Models**: YOLOv11, U-Net, ViT, Autoencoder
- **Feature Engineering**: Scikit-learn, GeoPandas
- **Model Registry**: MLflow

### Infrastructure
- **Cloud**: AWS (S3, RDS, ECS, Lambda, CloudWatch)
- **Containerization**: Docker
- **Orchestration**: Kubernetes (EKS)
- **IaC**: Terraform, CloudFormation
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana, ELK Stack

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

### Assets
```
GET    /api/v1/assets              # List assets
POST   /api/v1/assets              # Create asset
GET    /api/v1/assets/{id}         # Get asset details
PUT    /api/v1/assets/{id}         # Update asset
DELETE /api/v1/assets/{id}         # Delete asset
```

### Imagery
```
GET    /api/v1/imagery            # List imagery
POST   /api/v1/imagery/process    # Process imagery
GET    /api/v1/imagery/{id}       # Get imagery metadata
```

### Alerts
```
GET    /api/v1/alerts             # List alerts
POST   /api/v1/alerts             # Create alert
GET    /api/v1/alerts/{id}        # Get alert details
```

### Analytics
```
GET    /api/v1/analytics/health   # Asset health scores
GET    /api/v1/analytics/risks    # Risk analysis
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

- [Architecture Documentation](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Data Schema](./docs/DATA_SCHEMA.md)

## Contributing

1. Create feature branch: `git checkout -b feature/component-name`
2. Commit changes: `git commit -m 'Add feature description'`
3. Push to branch: `git push origin feature/component-name`
4. Submit pull request

## License

Proprietary - Transmission Asset Intelligence Platform

## Contact

For support and questions, contact: support@tams.io

---

**Current Phase**: 1 - Satellite Monitoring Platform
**Next Phase**: Phase 2 - GIS + Weather Integration

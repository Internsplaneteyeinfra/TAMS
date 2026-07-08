# Project Development Guide

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Git
- AWS CLI (for deployment)

### Local Development Setup

#### 1. Clone Repository
```bash
git clone <repo-url>
cd tams
```

#### 2. Setup Environment Files
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your configuration
```

#### 3. Option A: Docker Compose (Recommended)
```bash
docker-compose up -d
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

#### 4. Option B: Local Development

**Terminal 1 - Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

**Terminal 2 - Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Terminal 3 - Database**
```bash
# Ensure PostgreSQL with PostGIS is running
docker run -d \
  --name postgres \
  -e POSTGRES_USER=tams_user \
  -e POSTGRES_PASSWORD=tams_password \
  -e POSTGRES_DB=tams_db \
  -p 5432:5432 \
  postgis/postgis:15-3.3
```

### Project Structure Overview

```
tams/
├── frontend/          # React/Next.js UI
├── backend/           # FastAPI backend
├── ml/                # ML models and pipelines
├── data/              # Database schemas and migrations
├── infrastructure/    # IaC and K8s manifests
├── docker/            # Docker configurations
├── tests/             # Test suites
└── docs/              # Documentation
```

## Development Workflow

### 1. Creating a Feature

```bash
# Create feature branch
git checkout -b feature/component-name

# Make changes and test
npm run test
pytest

# Commit with descriptive message
git commit -m "Add feature: description"

# Push and create PR
git push origin feature/component-name
```

### 2. Code Quality Checks

```bash
# Lint frontend
npm run lint:frontend

# Format frontend
cd frontend && npm run format

# Lint backend
npm run lint:backend

# Type checking
cd frontend && npm run type-check
```

### 3. Testing

```bash
# All tests
npm run test

# Frontend only
npm run test:frontend

# Backend only
npm run test:backend

# With coverage
cd backend && pytest --cov=app
```

## Key Components

### Frontend (Next.js + Mapbox)
- **Location**: `frontend/src`
- **Key Components**:
  - `pages/` - Page components
  - `components/` - Reusable components
  - `lib/api` - API client
  - `lib/hooks` - Custom hooks

### Backend (FastAPI)
- **Location**: `backend/app`
- **Key Modules**:
  - `api/v1` - API routes
  - `services/` - Business logic
  - `models/` - ORM models
  - `db/` - Database configuration

### ML Models
- **Location**: `ml/models`
- **Models**:
  - Tower Detection (YOLOv11)
  - Vegetation Monitoring (U-Net)
  - Thermal Anomaly Detection (Autoencoder)

## Common Tasks

### Running Database Migrations
```bash
cd backend
alembic upgrade head
```

### Creating New API Endpoint
```python
# backend/app/api/v1/new_endpoint.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_data():
    return {"data": []}
```

### Adding ML Model Integration
```python
# backend/app/services/ml_service.py
from ml.models.tower_detection import TowerDetector

detector = TowerDetector()
results = detector.predict(image)
```

### Creating Database Model
```python
# backend/app/models/new_model.py
from sqlalchemy import Column, Integer, String
from app.db.database import Base

class NewModel(Base):
    __tablename__ = "new_models"
    id = Column(Integer, primary_key=True)
    name = Column(String)
```

## Deployment

### AWS Deployment
```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

### Kubernetes Deployment
```bash
# Dev environment
kubectl apply -f infrastructure/kubernetes/dev/

# Prod environment
kubectl apply -f infrastructure/kubernetes/prod/
```

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Connect to database
psql -U tams_user -d tams_db -h localhost
```

### Port Already in Use
```bash
# Find process using port
lsof -i :8000  # or :3000, :5432

# Kill process
kill -9 <PID>
```

### Docker Build Issues
```bash
# Clean build
docker-compose build --no-cache

# View logs
docker-compose logs -f <service-name>
```

## Resources

- [API Documentation](../docs/API.md)
- [Architecture Guide](../docs/ARCHITECTURE.md)
- [Database Schema](./enterprise/04-DATABASE-DESIGN.md)

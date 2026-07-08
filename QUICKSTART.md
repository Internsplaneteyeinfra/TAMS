# TAMS Project - Setup & Quick Start Guide

## Project Successfully Scaffolded! 🎉

Your **Transmission Asset Monitoring System (TAMS)** is ready for development.

## What's Been Created

### Project Structure
```
tams/
├── frontend/              # React/Next.js GIS Command Center
├── backend/               # FastAPI backend services
├── ml/                    # ML models and pipelines
├── data/                  # Database schemas and migrations
├── infrastructure/        # Infrastructure as Code (Terraform, Kubernetes)
├── docker/                # Docker configurations
├── tests/                 # Test suites
├── docs/                  # Documentation
└── config/                # Configuration files
```

### Key Components
✅ **Frontend**: Next.js 14, TypeScript, Leaflet/Cesium, Material UI, Tailwind CSS  
✅ **Backend**: FastAPI, PostgreSQL with PostGIS, Redis, Celery  
✅ **AI/ML**: YOLOv11, U-Net, Autoencoder, MLflow  
✅ **Infrastructure**: Terraform (AWS), Kubernetes, Docker Compose  
✅ **CI/CD**: GitHub Actions workflows  
✅ **Documentation**: Architecture, API, Development guides  

## Quick Start

### 1. Setup Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your Mapbox token
```

### 2. Option A: Docker Compose (Recommended)
```bash
cd tams
docker-compose up -d
```

Access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 3. Option B: Local Development

**Terminal 1 - Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

**Terminal 2 - Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Terminal 3 - PostgreSQL (if not using Docker)**
```bash
docker run -d \
  --name postgres \
  -e POSTGRES_USER=tams_user \
  -e POSTGRES_PASSWORD=tams_password \
  -e POSTGRES_DB=tams_db \
  -p 5432:5432 \
  postgis/postgis:15-3.3
```

## Next Steps

### 1. Install Dependencies
```bash
# All components
npm install

# Or individually
cd frontend && npm install
cd backend && pip install -r requirements.txt
cd ml && pip install -r requirements.txt
```

### 2. Database Setup
```bash
cd backend
alembic upgrade head
```

### 3. Run Tests
```bash
npm run test
```

### 4. Start Development
```bash
npm run dev
```

## Important Files to Review

### Configuration
- [.github/copilot-instructions.md](.github/copilot-instructions.md) - Development guidelines
- [backend/.env.example](backend/.env.example) - Backend configuration template
- [frontend/.env.example](frontend/.env.example) - Frontend configuration template

### Documentation
- [README.md](README.md) - Project overview
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/API.md](docs/API.md) - API documentation
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Development guide

### Key Backend Files
- [backend/app/main.py](backend/app/main.py) - FastAPI application entry point
- [backend/app/core/config.py](backend/app/core/config.py) - Configuration management
- [backend/app/db/database.py](backend/app/db/database.py) - Database setup

### Key Frontend Files
- [frontend/src/pages/index.tsx](frontend/src/pages/index.tsx) - Home page
- [frontend/src/components/GISMap.tsx](frontend/src/components/GISMap.tsx) - Map component
- [frontend/src/lib/store.ts](frontend/src/lib/store.ts) - Redux store

## Development Workflow

### Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### Make Changes & Test
```bash
npm run test
npm run lint
```

### Commit & Push
```bash
git commit -m "Add feature: description"
git push origin feature/your-feature-name
```

### Create Pull Request
Open PR on GitHub with test coverage report

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
kubectl apply -f infrastructure/kubernetes/prod/
```

## Team & Communication

- **3 Developers**: Frontend, Backend, ML
- **Communication**: Use git branches, PRs, and commit messages
- **Code Review**: 1 approval required before merge
- **Testing**: Minimum 70% coverage required

## API Endpoints

### Assets
```
GET    /api/v1/assets              # List assets
POST   /api/v1/assets              # Create asset
GET    /api/v1/assets/{id}         # Get asset
PATCH  /api/v1/assets/{id}         # Update asset
DELETE /api/v1/assets/{id}         # Delete asset
```

### Imagery
```
GET    /api/v1/imagery            # List imagery
POST   /api/v1/imagery/upload     # Upload imagery
POST   /api/v1/imagery/{id}/process  # Process imagery
```

### Alerts
```
GET    /api/v1/alerts             # List alerts
POST   /api/v1/alerts             # Create alert
PATCH  /api/v1/alerts/{id}        # Update alert
```

### Analytics
```
GET    /api/v1/analytics/health   # Health scores
GET    /api/v1/analytics/risks    # Risk analysis
```

## Troubleshooting

### Port Already in Use
```bash
lsof -i :8000  # Find process
kill -9 <PID>   # Kill process
```

### Docker Build Issues
```bash
docker-compose build --no-cache
docker-compose logs -f
```

### Database Connection
```bash
# Check PostgreSQL
docker ps | grep postgres
psql -U tams_user -d tams_db -h localhost
```

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Mapbox GL Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

## Support

For questions or issues:
1. Check the [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) guide
2. Review [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. Check API documentation at `/docs` endpoint

---

**Happy Coding!** 🚀

**Next Phase Features** (enterprise roadmap):
- Phase 2: SCADA/IoT real-time ingestion, Azure AD, SignalR
- Phase 3: Mobile app, EAM integration, reporting engine
- Phase 4: Predictive maintenance, AI Copilot
- Phase 5: Digital Twin, Azure/.NET production migration

See [docs/enterprise/09-IMPLEMENTATION-PLAN.md](docs/enterprise/09-IMPLEMENTATION-PLAN.md).

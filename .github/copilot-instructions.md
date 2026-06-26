# TAMS Project - Copilot Development Instructions

## Project Overview
AI-Powered Transmission Asset Intelligence & Monitoring Platform (TAMS)
- **Current Phase**: Phase 1 - Satellite Monitoring Platform
- **Team Size**: 3 developers
- **Cloud**: AWS
- **Language**: TypeScript (Frontend), Python (Backend)

## Core Principles

### Architecture
- Monorepo structure with Frontend (Next.js), Backend (FastAPI), ML services
- Microservices-ready with Docker and Kubernetes
- Multi-tenant capable
- Production-grade from Phase 1

### Code Quality
- Type safety: Strict TypeScript + Python type hints
- Testing: Unit, Integration, E2E test coverage minimum 70%
- Linting: ESLint, Prettier, Pylint, Black
- Documentation: JSDoc/Docstrings for all public APIs

### Naming Conventions
- **Components**: PascalCase (GISMap, TowerList)
- **Functions**: camelCase (fetchTowerData, processImagery)
- **Constants**: UPPER_SNAKE_CASE (MAX_IMAGERY_SIZE)
- **Files**: kebab-case for components (map-control.tsx), snake_case for Python (process_imagery.py)
- **Database tables**: snake_case (transmission_towers, asset_health_scores)

### Development Workflow
1. Create feature branch from `main`: `feature/component-name`
2. Make atomic commits with descriptive messages
3. Run tests and linting locally before pushing
4. Submit PR with test coverage report
5. Require 1 approval before merge

### File Organization

#### Frontend (src/)
```
components/
  ├── maps/          # Map components (GISMap, LayerControl)
  ├── dashboard/     # Dashboard components (AssetList, AlertsPanel)
  ├── common/        # Shared components (Header, Sidebar)
  └── ui/            # UI components (Button, Modal, Form)

pages/
  ├── index.tsx      # Dashboard home
  ├── command-center.tsx
  ├── assets/
  ├── alerts/
  └── analytics/

lib/
  ├── api/           # API client functions
  ├── hooks/         # Custom React hooks
  ├── utils/         # Utility functions
  └── constants/     # Constants and enums
```

#### Backend (app/)
```
api/
  ├── v1/
  │   ├── assets.py     # Assets endpoints
  │   ├── imagery.py    # Imagery endpoints
  │   ├── alerts.py     # Alerts endpoints
  │   └── analytics.py  # Analytics endpoints
  └── middleware/       # Custom middleware

services/
  ├── asset_service.py
  ├── imagery_service.py
  ├── alert_service.py
  └── ml_service.py     # ML model integration

models/
  ├── asset.py         # ORM models
  ├── imagery.py
  └── alert.py

schemas/
  ├── asset.py         # Pydantic request/response schemas
  ├── imagery.py
  └── alert.py

db/
  ├── database.py      # Connection setup
  ├── session.py       # Session management
  └── crud/            # CRUD operations
```

## Technology Stack Guidelines

### Frontend Stack
- **Framework**: Next.js 14 with App Router
- **Type Safety**: TypeScript strict mode
- **State**: Redux Toolkit for global state
- **Maps**: Mapbox GL JS with type wrappers
- **UI Library**: Shadcn/ui with Tailwind CSS
- **Data Fetching**: React Query + Axios
- **Forms**: React Hook Form + Zod validation
- **Testing**: Vitest + Playwright

### Backend Stack
- **Framework**: FastAPI with Starlette
- **Database**: AsyncPG for PostgreSQL
- **Type Hints**: Pydantic v2 for validation
- **Async**: asyncio + aiohttp
- **Task Queue**: Celery with Redis
- **Authentication**: JWT + OAuth2
- **Testing**: Pytest with async support

### ML Stack
- **Computer Vision**: PyTorch + TorchVision
- **GIS**: GeoPandas + Rasterio
- **Feature Extraction**: GDAL
- **Model Serving**: FastAPI + TensorRT
- **Experiment Tracking**: MLflow

## API Design Standards

### REST Endpoints
```python
# Pattern: /api/v1/{resource}[/{id}][/{action}]

GET    /api/v1/assets              # List with pagination, filters
POST   /api/v1/assets              # Create single
GET    /api/v1/assets/{id}         # Get single
PATCH  /api/v1/assets/{id}         # Update single
DELETE /api/v1/assets/{id}         # Delete single
POST   /api/v1/assets/batch        # Bulk operations
GET    /api/v1/assets/search       # Advanced search
```

### Response Format
```python
{
  "data": {...} | [...],
  "meta": {
    "timestamp": "2024-06-10T12:00:00Z",
    "version": "1.0",
    "request_id": "uuid"
  },
  "errors": [...] # Only if errors
}
```

### Database Schema Patterns
- All tables: `id` (UUID primary key), `created_at`, `updated_at`, `deleted_at` (soft delete)
- Foreign keys: Use composite keys for multi-tenant scenarios
- Indexing: Index frequently queried columns (asset_id, status, geom for spatial)
- Partitioning: Time-series data partitioned by month

## Testing Requirements

### Frontend Testing
- Minimum 70% coverage for components
- Unit tests for utilities and hooks
- Integration tests for page flows
- E2E tests for critical user journeys

```typescript
// Component test template
describe('GISMap', () => {
  it('should render map with assets', () => {
    // Arrange, Act, Assert
  });
});
```

### Backend Testing
- Unit tests for services
- Integration tests for API endpoints
- Database migrations tested
- ML model inference tested

```python
# Service test template
def test_asset_service_get_by_id(db_session):
    # Arrange, Act, Assert
    pass
```

## Security Guidelines
- Environment variables for all secrets (use .env.local, .env)
- API authentication: JWT tokens, 1-hour expiry
- Rate limiting: 1000 req/min per IP
- Input validation: Pydantic schemas for all inputs
- SQL injection prevention: Use parameterized queries
- CORS: Restrict to known origins
- HTTPS only in production
- Database encryption at rest

## Performance Guidelines
- API response time: < 500ms (p95)
- Database queries: < 100ms
- Image processing: < 5s for typical scene
- Frontend: LCP < 2.5s, FID < 100ms
- Caching: Redis for API responses, 5-minute TTL default
- Pagination: 100 items default, max 1000
- Database indexes on: foreign keys, status fields, timestamps

## Logging Standards
- Structured JSON logging (Python: structlog, JS: pino)
- Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
- Include: timestamp, level, module, message, context, request_id

## Deployment Standards
- Docker multi-stage builds for optimized images
- Environment-specific configs: dev, staging, prod
- Kubernetes manifests for orchestration
- Health checks on all containers
- Resource limits defined (CPU, memory)
- Graceful shutdown support

## Version Control Workflow
- Main branch: Always deployable, protected
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Hotfixes: `hotfix/description`
- Release: Tag with semantic versioning (v1.0.0)

## Documentation Requirements
- Inline comments for complex logic
- JSDoc for all exported functions/types
- Docstrings for all Python functions
- README for each major module
- Architecture diagrams for system design
- API documentation: Auto-generated from OpenAPI/Swagger

## CI/CD Pipeline
- GitHub Actions for automation
- Run linting on push
- Run tests on pull request
- Build Docker images on merge
- Deploy to staging on merge
- Manual approval for production deployment

---

**Last Updated**: 2024-06-10
**Maintained By**: TAMS Development Team

# TAMS System Architecture

## Overview

TAMS (Transmission Asset Monitoring System) is an enterprise-grade platform for monitoring high-voltage transmission networks using satellite data, GIS visualization, asset registry, condition monitoring, and predictive analytics.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    GIS Command Center                            │
│          (React/Next.js + Mapbox + CesiumJS)                    │
│                                                                  │
│  ┌────────────────┬───────────────┬──────────────┐              │
│  │  Interactive   │   Dashboard   │  Analytics   │              │
│  │     Maps       │     View      │   Reports    │              │
│  └────────────────┴───────────────┴──────────────┘              │
└────────────────────────────────────────────────────────────────┬─┘
                               ▲
                               │
                      HTTP/REST/GraphQL
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                      API Layer                                   │
│                   (FastAPI + GraphQL)                           │
│                                                                  │
│  ┌──────────┬──────────┬──────────┬──────────┐                 │
│  │ Assets   │ Imagery  │ Alerts   │ Analytics│                 │
│  │ Endpoint │ Endpoint │ Endpoint │ Endpoint │                 │
│  └──────────┴──────────┴──────────┴──────────┘                 │
└────────────────────────────────────────────────────────────────┬─┘
                               ▲
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐
│  Core Services  │   │ ML/AI Services  │   │ Data Processing  │
│                 │   │                 │   │                  │
│ • Asset Service │   │ • Tower Det.    │   │ • Satellite Proc │
│ • Imagery Svc   │   │ • Vegetation    │   │ • Feature Extr.  │
│ • Alert Engine  │   │ • Anomaly Det.  │   │ • Normalization  │
│ • Analytics     │   │ • Risk Scoring  │   │ • Cataloging     │
└─────────────────┘   └─────────────────┘   └──────────────────┘
        ▲                      ▲                      ▲
        └──────────────────────┼──────────────────────┘
                               │
                      Data Access Layer
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐
│    PostgreSQL   │   │     Redis       │   │   AWS S3         │
│    + PostGIS    │   │     Cache       │   │  Imagery Store   │
│                 │   │                 │   │                  │
│ • Vector Data   │   │ • API Cache     │   │ • GeoTIFF Files  │
│ • Geometries    │   │ • Sessions      │   │ • Sentinel Data  │
│ • Time Series   │   │ • Task Queue    │   │ • Raw Imagery    │
│ • Assets        │   │ • Real-time     │   │ • Processing     │
└─────────────────┘   └─────────────────┘   └──────────────────┘
```

## Core Components

### 1. Frontend (GIS Command Center)
**Technology**: React, Next.js 14, TypeScript, Leaflet, CesiumJS, Material UI

**Responsibilities**:
- Interactive map visualization
- Asset monitoring dashboard
- Real-time alert display
- Analytics and reporting
- User authentication and sessions

**Key Features**:
- Multi-layer map support
- Asset filtering and search
- Time-slider for temporal analysis
- Risk heatmap visualization
- 3D terrain and asset visualization

### 2. API Layer (Backend)
**Technology**: FastAPI, Python 3.11+, GraphQL

**Endpoints**:
- `/api/v1/assets` - Asset CRUD operations
- `/api/v1/imagery` - Satellite imagery management
- `/api/v1/alerts` - Alert management
- `/api/v1/analytics` - Analytics and reporting
- `/api/v1/ml` - ML model inference

**Response Format**:
```json
{
  "data": [...],
  "meta": {
    "timestamp": "2024-06-10T12:00:00Z",
    "version": "1.0",
    "request_id": "uuid"
  }
}
```

### 3. Core Services

#### Asset Service
- Asset inventory management
- Asset hierarchy (towers, lines, substations)
- Asset health scoring
- Metadata management

#### Imagery Service
- Satellite data ingestion
- Image processing pipeline
- Metadata extraction
- Geospatial indexing

#### Alert Engine
- Multi-source anomaly detection
- Alert generation and notification
- Alert lifecycle management
- Priority scoring

#### Analytics Service
- Risk analysis and scoring
- Health index calculation
- Trend analysis
- Reporting generation

### 4. ML/AI Layer

#### Models Deployed
- **YOLOv11**: Tower detection and localization
- **U-Net**: Corridor segmentation and vegetation monitoring
- **Autoencoder**: Thermal anomaly detection
- **Random Forest**: Risk scoring
- **Isolation Forest**: Outlier detection

#### Model Serving
- FastAPI endpoints for inference
- Model versioning with MLflow
- Batch processing capability
- Real-time prediction support

### 5. Data Layer

#### PostgreSQL + PostGIS
- Relational data storage
- Geospatial queries
- Asset relationships
- Historical data

**Key Tables**:
- `transmission_assets` - Tower, line, substation data
- `asset_health_scores` - Health metrics
- `satellite_imagery_metadata` - Image catalog
- `alerts` - Alert records
- `risk_assessments` - Risk analysis results

#### Redis Cache
- API response caching
- Session management
- Task queue (Celery)
- Real-time data streams

#### AWS S3
- Satellite imagery storage
- Processed imagery archive
- GeoTIFF repository
- Model weights storage

## Data Flow

### 1. Satellite Data Ingestion
```
STAC API → Download → Validation → S3 Upload → Metadata Catalog
    ↓
PostgreSQL (Catalog Entry)
```

### 2. Feature Extraction Pipeline
```
S3 GeoTIFF → Preprocessing → YOLOv11 Detection → Feature Extraction
    ↓
PostgreSQL (Asset Detection)
    ↓
Feature Vector → ML Models → Risk Scoring
```

### 3. Real-time Monitoring
```
SCADA/PMU Data → API Ingestion → Time-Series DB → Anomaly Detection
    ↓
Alert Generation → Notification → Frontend Update
```

### 4. Alert Generation
```
Anomaly Detection ─┬─→ Thermal Alerts
                  ├─→ Vegetation Alerts
                  ├─→ Structural Alerts
                  ├─→ Weather Alerts
                  └─→ Operational Alerts
                       ↓
                   Priority Scoring → Notification Engine
```

## Deployment Architecture

### Development Environment
- Docker Compose orchestration
- Local PostgreSQL + PostGIS
- Local Redis
- Local S3 (MinIO alternative)

### Production Environment (AWS)
```
┌─────────────────────────────────────────┐
│         Application Load Balancer       │
│            (ALB + HTTPS/TLS)            │
└────────────────────────────────────────┬┘
    ┌─────────────────────────┬──────────────────────┐
    │                         │                      │
    ▼                         ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ ECS Cluster  │      │ ECS Cluster  │      │ ECS Cluster  │
│   Frontend   │      │   Backend    │      │   ML Service │
│ (Auto-scaled)│      │ (Auto-scaled)│      │ (Auto-scaled)│
└──────────────┘      └──────────────┘      └──────────────┘
    ▲                         ▲                      ▲
    └─────────────────────────┼──────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
    ┌────────┐            ┌────────┐          ┌────────┐
    │  RDS   │            │ Redis  │          │  S3    │
    │ Multi- │            │ Cluster│          │ Bucket │
    │  AZ    │            │        │          │        │
    └────────┘            └────────┘          └────────┘
```

### Kubernetes Deployment (Alternative)
- Namespace isolation
- StatefulSets for databases
- Deployments for services
- HPA for auto-scaling
- Ingress for routing

## Security Architecture

### Authentication & Authorization
- JWT token-based authentication
- OAuth2 integration
- Role-based access control (RBAC)
- Multi-tenant support

### Data Security
- TLS/HTTPS everywhere
- Database encryption at rest
- S3 bucket encryption
- API key management (Secrets Manager)
- Input validation (Pydantic schemas)

### Compliance
- Audit logging
- Data retention policies
- GDPR compliance features
- Encryption key management

## Scalability Considerations

### Horizontal Scaling
- Stateless services (containers)
- Database connection pooling
- Caching strategy (Redis)
- Load balancing (ALB/Ingress)

### Vertical Scaling
- Database optimization
- Query indexing strategy
- Connection limits tuning
- Memory optimization

### Data Volume Management
- Time-series partitioning
- Data archival strategy
- Image compression
- Pagination limits

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time (p95) | < 500ms | - |
| Database Query Time | < 100ms | - |
| Image Processing (typical) | < 5s | - |
| Frontend LCP | < 2.5s | - |
| Uptime | 99.9% | - |

## Monitoring & Observability

### Logging
- Structured JSON logging
- Centralized log aggregation (ELK Stack)
- Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL

### Metrics
- Prometheus endpoint
- Grafana dashboards
- CloudWatch metrics
- Custom application metrics

### Tracing
- Distributed tracing (Jaeger)
- Request ID propagation
- Performance profiling

## Future Roadmap

| Phase | Focus | Prototype status |
|-------|-------|------------------|
| **1** | Satellite + Asset Registry + GIS + Alarms + Health + Maintenance | ✅ Implemented (FastAPI + Next.js) |
| **2** | SCADA/IoT ingestion, Azure AD, SignalR | 📋 Planned |
| **3** | Mobile app, EAM integration, reporting engine | 📋 Planned |
| **4** | Predictive maintenance, AI Copilot | 📋 Planned |
| **5** | Digital Twin, Azure/.NET production stack | 📋 Target |

Enterprise delivery plan: [enterprise/09-IMPLEMENTATION-PLAN.md](./enterprise/09-IMPLEMENTATION-PLAN.md)

---

**Last Updated**: July 2026
**Architecture Maintained By**: TAMS Development Team

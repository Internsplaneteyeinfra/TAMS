# Enterprise Architecture Document
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-EA-001  
**Version:** 1.0  
**Date:** July 2026

---

## 1. Architecture Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | Cloud-Native First | Azure PaaS/SaaS over self-managed infrastructure |
| 2 | Zero Trust Security | Never trust, always verify; micro-segmentation |
| 3 | API-First Design | All capabilities exposed via versioned REST APIs |
| 4 | Event-Driven Integration | Async messaging for SCADA, alarms, notifications |
| 5 | Polyglot Persistence | SQL Server for transactional; ADX for time-series |
| 6 | Separation of OT/IT | DMZ gateway; no direct OT-to-cloud connection |
| 7 | Scalable by Design | Horizontal scaling; partition by region/corridor |
| 8 | Observability Built-In | Metrics, logs, traces from day one |

---

## 2. Architecture Diagram (Logical)

```
                                    ┌─────────────────────┐
                                    │   Azure Front Door   │
                                    │  (WAF, CDN, Routing) │
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
          ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
          │  React Web App    │      │ React Native    │      │  Admin Portal   │
          │  (Static Web App) │      │  Mobile App     │      │  (React/MUI)    │
          └────────┬────────┘      └────────┬────────┘      └────────┬────────┘
                   │                        │                          │
                   └────────────────────────┼──────────────────────────┘
                                            │ HTTPS
                                            ▼
                              ┌─────────────────────────┐
                              │   Azure API Management │
                              │  (Auth, Rate Limit,    │
                              │   Policy, Versioning)  │
                              └────────────┬────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│  Asset Service  │              │ Monitoring Svc  │              │  Alarm Service  │
│  (.NET 8 API)   │              │  (.NET 8 API)   │              │  (.NET 8 API)   │
└────────┬────────┘              └────────┬────────┘              └────────┬────────┘
         │                                 │                                 │
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│  Health Service │              │ Maintenance Svc │              │ Inspection Svc  │
│  (.NET 8 API)   │              │  (.NET 8 API)   │              │  (.NET 8 API)   │
└────────┬────────┘              └────────┬────────┘              └────────┬────────┘
         │                                 │                                 │
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│ Predictive Svc  │              │  Analytics Svc  │              │ Notification Svc│
│  (.NET 8 + ML)  │              │  (.NET 8 API)   │              │  (.NET 8 API)   │
└────────┬────────┘              └────────┬────────┘              └────────┬────────┘
         │                                 │                                 │
         └─────────────────────────────────┼─────────────────────────────────┘
                                           │
                              ┌────────────▼────────────┐
                              │   Azure Service Bus     │
                              │  (Topics & Queues)      │
                              └────────────┬────────────┘
                                           │
    ┌──────────────┬───────────────────────┼───────────────────────┬──────────────┐
    │              │                       │                       │              │
    ▼              ▼                       ▼                       ▼              ▼
┌────────┐  ┌────────────┐        ┌────────────┐        ┌────────────┐  ┌────────────┐
│Azure   │  │ Azure Data │        │ Azure Blob │        │ Azure Redis│  │ Azure Key  │
│SQL     │  │ Explorer   │        │ Storage    │        │ Cache      │  │ Vault      │
│Server  │  │ (ADX)      │        │ (Media)    │        │            │  │            │
└────────┘  └────────────┘        └────────────┘        └────────────┘  └────────────┘

                              INGESTION & STREAMING LAYER
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                                                                             │
    │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                │
    │  │ Azure IoT Hub│───▶│ Azure Event  │───▶│ Azure        │                │
    │  │              │    │ Hub          │    │ Functions    │                │
    │  └──────▲───────┘    └──────────────┘    └──────┬───────┘                │
    │         │                                        │                         │
    │  ┌──────┴───────┐                       ┌───────▼────────┐                │
    │  │ IoT Edge     │                       │ Stream Analytics│                │
    │  │ Gateway(DMZ) │                       │ (Real-time)     │                │
    │  └──────▲───────┘                       └────────────────┘                │
    │         │                                                                  │
    │  ┌──────┴───────────────────────────────────────────┐                     │
    │  │  OT Network: SCADA │ RTU │ PMU │ DGA │ IoT Sensors│                     │
    │  └────────────────────────────────────────────────────┘                     │
    └─────────────────────────────────────────────────────────────────────────────┘

                              AI / ML LAYER
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │  Azure ML Workspace │ Azure OpenAI │ Azure Data Lake Gen2 │ MLflow        │
    │  Models: Failure Prediction, Anomaly Detection, RUL, Image Analysis       │
    └─────────────────────────────────────────────────────────────────────────────┘

                              OBSERVABILITY
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │  Azure Monitor │ Application Insights │ Log Analytics │ Azure Dashboards  │
    └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack Detail

### 3.1 Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 18+ | SPA component architecture |
| Language | TypeScript 5+ | Type safety |
| UI Library | Material UI (MUI) v5+ | Enterprise component library |
| State | Redux Toolkit + RTK Query | Global state + API caching |
| Maps | ArcGIS JS API 4.x, Leaflet | GIS visualization |
| Charts | Recharts / MUI X Charts | Dashboards and trends |
| Real-time | SignalR Client | Live sensor/alarm updates |
| Auth | MSAL.js (Microsoft Authentication Library) | Azure AD SSO |
| Build | Vite / CRA | Production bundling |
| Hosting | Azure Static Web Apps | CDN-backed deployment |

### 3.2 Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | .NET 8 Web API | REST microservices |
| ORM | Entity Framework Core 8 | SQL Server data access |
| Validation | FluentValidation | Request validation |
| Mapping | AutoMapper | DTO mapping |
| Auth | Microsoft.Identity.Web | Azure AD JWT validation |
| Real-time | ASP.NET Core SignalR | WebSocket hub |
| Messaging | Azure.Messaging.ServiceBus | Async events |
| Caching | StackExchange.Redis | Distributed cache |
| Logging | Serilog + App Insights | Structured logging |
| API Docs | Swashbuckle (OpenAPI 3) | API specification |
| Hosting | Azure Container Apps / AKS | Container orchestration |

### 3.3 Data Layer

| Store | Technology | Data |
|-------|------------|------|
| Operational DB | Azure SQL Database (Business Critical) | Assets, users, alarms, work orders, inspections |
| Time-Series DB | Azure Data Explorer | Sensor readings, health score history |
| Blob Storage | Azure Blob (Hot/Cool/Archive) | Images, videos, reports, ML datasets |
| Data Lake | Azure Data Lake Gen2 | Raw SCADA archives, ML training data |
| Cache | Azure Cache for Redis | Sessions, dashboard cache, rate limiting |

### 3.4 Azure Services Map

| Azure Service | TAMS Usage |
|---------------|------------|
| Azure IoT Hub | Device registry, telemetry ingestion from RTUs/sensors |
| Azure Event Hub | High-throughput streaming (millions events/day) |
| Azure Functions | Protocol transformation, alarm rule evaluation, scheduled jobs |
| Azure Service Bus | Inter-service messaging, EAM integration events |
| Azure Data Explorer | Sensor time-series queries, trend analysis |
| Azure Data Lake | Historical data archive, ML feature store |
| Azure AI Services | Custom Vision (inspection), Anomaly Detector |
| Azure OpenAI | AI Copilot (Phase 5), natural language queries |
| Azure Monitor | Infrastructure and application metrics |
| Application Insights | APM, dependency tracking, distributed tracing |
| Azure Key Vault | Secrets, certificates, encryption keys |
| Azure API Management | API gateway, throttling, developer portal |
| Azure Front Door | Global load balancing, WAF, SSL termination |
| Azure Entra ID | Identity, MFA, RBAC, conditional access |
| Azure Notification Hubs | Mobile push notifications |
| Azure Communication Services | Email, SMS |
| Azure ML | Model training, deployment, MLOps |
| Azure Static Web Apps | Frontend hosting |
| Azure Container Apps | Microservice hosting (alternative: AKS) |

---

## 4. Microservices Decomposition

| Service | Responsibility | Database | Events Published |
|---------|---------------|----------|------------------|
| **AssetService** | Asset CRUD, hierarchy, QR, lifecycle | SQL | AssetCreated, AssetUpdated |
| **MonitoringService** | Sensor config, live values, trends | ADX + SQL | SensorReadingReceived |
| **AlarmService** | Alarm rules, lifecycle, escalation | SQL | AlarmGenerated, AlarmAcknowledged |
| **HealthService** | Health/condition/risk score computation | SQL + ADX | HealthScoreUpdated |
| **MaintenanceService** | Work orders, scheduling, spare parts | SQL | WorkOrderCreated, WorkOrderCompleted |
| **InspectionService** | Inspection CRUD, media upload, AI trigger | SQL + Blob | InspectionCompleted |
| **GISService** | Spatial queries, layer management, analytics | SQL (spatial) | — |
| **PredictiveService** | ML inference, recommendations | SQL + Azure ML | PredictionGenerated |
| **AnalyticsService** | KPI computation, dashboard data | ADX + SQL | — |
| **NotificationService** | Email, SMS, Teams, WhatsApp, push | SQL | — (consumer) |
| **ReportService** | PDF/Excel/CSV generation | SQL + Blob | ReportGenerated |
| **IdentityService** | User profile, preferences, role sync | SQL | — |
| **AuditService** | Immutable audit log | SQL | — (consumer) |

---

## 5. Data Flow Architecture

### 5.1 Sensor Ingestion Pipeline

```
RTU/Sensor → IoT Edge Gateway → IoT Hub → Event Hub → Stream Analytics
                                                          │
                                    ┌─────────────────────┼─────────────────────┐
                                    │                     │                     │
                                    ▼                     ▼                     ▼
                              Azure Function          ADX Ingest           Service Bus
                              (Normalize)             (Store)              (Alarm Check)
                                    │                     │                     │
                                    └─────────────────────┼─────────────────────┘
                                                          ▼
                                                   Alarm Service
                                                          │
                                                          ▼
                                              Notification Service
                                                          │
                                    ┌─────────────────────┼─────────────────────┐
                                    ▼                     ▼                     ▼
                                 SignalR               Mobile Push            Teams/SMS
                              (Web Dashboard)         (Field Tech)          (On-call)
```

**Throughput Design:**
- Peak: 5M records/day ≈ 58 records/second average, 500/sec peak
- Event Hub: 16 partitions, 20 TU
- ADX: 3-node cluster (Standard tier), partitioned by AssetId + Timestamp

### 5.2 Health Score Pipeline

```
Daily Trigger (Azure Function Timer)
    → Query ADX (sensor trends, load history)
    → Query SQL (inspection scores, failure history, asset age)
    → HealthService.ComputeScore()
    → Store in SQL (current) + ADX (history)
    → Publish HealthScoreUpdated event
    → AnalyticsService updates dashboards
    → PredictiveService triggers if score < threshold
```

### 5.3 Inspection AI Pipeline

```
Mobile/Web Upload → Blob Storage → Service Bus (InspectionMediaUploaded)
    → Azure Function triggers Azure ML endpoint
    → Custom Vision / YOLO inference
    → Results stored in SQL (InspectionAIResults)
    → InspectionService updates defect list
    → HealthService recalculates score
    → Notification if critical defect detected
```

---

## 6. Integration Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   SCADA/OT   │────▶│  IoT Edge    │────▶│  Azure IoT   │
│   Systems    │     │  (DMZ)       │     │  Hub         │
└──────────────┘     └──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   EAM System │◀───▶│  Service Bus │◀───▶│  Maintenance │
│   (SAP/Max)  │     │  Integration │     │  Service     │
└──────────────┘     └──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ArcGIS Ent. │◀───▶│  GIS Service │◀───▶│  Asset Svc   │
│  Feature Svr │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│  Weather API │────▶│  Monitoring  │
│  (Azure Maps)│     │  Service     │
└──────────────┘     └──────────────┘
```

---

## 7. Deployment Architecture (Physical)

### 7.1 Production Environment

| Component | Azure Resource | SKU/Tier | HA |
|-----------|---------------|----------|-----|
| Frontend | Static Web Apps | Standard | Multi-region |
| API Gateway | API Management | Premium (VNet) | Multi-region |
| Microservices | Container Apps | Dedicated workload profiles | 3+ replicas |
| SQL Database | Azure SQL | Business Critical, 8 vCore | Zone redundant |
| ADX Cluster | Azure Data Explorer | Standard, 3 nodes | Zone redundant |
| IoT Hub | Standard S2 | 12 units | SLA 99.9% |
| Event Hub | Standard | 16 partitions, 20 TU | Zone redundant |
| Redis | Azure Cache for Redis | Premium P2 (6 GB) | Zone redundant |
| Blob Storage | StorageV2 | GRS (geo-redundant) | RA-GRS |
| Key Vault | Premium (HSM) | — | Soft delete enabled |
| Front Door | Premium | WAF managed rules | Global |

### 7.2 Network Architecture

```
Internet
    │
    ▼
Azure Front Door (WAF)
    │
    ├──▶ Static Web Apps (Frontend) ── Private Endpoint
    │
    └──▶ API Management (VNet Integrated)
              │
              ▼
         Azure Container Apps (VNet: 10.1.0.0/16)
              │
    ┌─────────┼─────────┬─────────────┐
    │         │         │             │
    ▼         ▼         ▼             ▼
  SQL DB    ADX      Redis         Blob Storage
  (PE)      (PE)     (PE)          (PE)

OT DMZ VNet (10.2.0.0/16)
    │
    ▼
IoT Edge Gateway ──▶ IoT Hub (via Private Endpoint)
    ▲
    │
SCADA/RTU/PMU (OT Network 10.3.0.0/16)
```

**Zero Trust Controls:**
- No public endpoints on data tier (Private Endpoints only)
- NSG rules: deny all inbound except APIM → Container Apps
- Azure Firewall for outbound traffic inspection
- Conditional Access: MFA + compliant device required
- JIT access for admin operations via Azure PIM

---

## 8. Scalability Design

| Layer | Strategy | Capacity |
|-------|----------|----------|
| Ingestion | Event Hub partitions scale | 5M+ records/day |
| Processing | Azure Functions auto-scale | 200 concurrent instances |
| API | Container Apps HPA (CPU 70%) | 2–20 replicas per service |
| SQL | Read replicas for reporting | 1 primary + 2 read replicas |
| ADX | Scale out nodes | 3–10 nodes based on query load |
| Cache | Redis cluster mode | 6 GB → 26 GB scale |
| Frontend | CDN via Front Door | Global edge caching |

---

## 9. Disaster Recovery

| Scenario | RPO | RTO | Strategy |
|----------|-----|-----|----------|
| SQL Database failure | 5 min | 1 hour | Auto-failover (zone redundant) |
| Region failure | 15 min | 4 hours | Paired region failover (SQL geo-replication, ADX follower) |
| Data corruption | 1 hour | 8 hours | Point-in-time restore (SQL 35-day retention) |
| IoT Hub failure | 0 | 30 min | IoT Hub disaster recovery (manual failover) |

---

## 10. Architecture Decision Records (ADRs)

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | Azure over AWS/GCP | Enterprise Microsoft agreement; Entra ID; OT/IT alignment |
| ADR-002 | .NET 8 over Python/Java | Utility enterprise standard; performance; Azure SDK maturity |
| ADR-003 | ADX over TimescaleDB | Native Azure integration; Kusto query language; petabyte scale |
| ADR-004 | Microservices over monolith | Independent scaling; team autonomy; fault isolation |
| ADR-005 | Service Bus over direct calls | Decoupling; retry; dead-letter for integration |
| ADR-006 | Material UI over custom | Accessibility; enterprise patterns; rapid development |
| ADR-007 | Container Apps over AKS (Phase 1-3) | Lower ops overhead; migrate to AKS if needed Phase 4+ |

---

**Maintained By:** Enterprise Architecture Team  
**Next Review:** October 2026

# MVP & Production Release Strategy
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-RELEASE-001  
**Version:** 1.0  
**Date:** July 2026

---

## 1. Release Strategy Overview

TAMS follows a **phased release model** with three major release gates:

| Release | Name | Target | Scope |
|---------|------|--------|-------|
| R1 | MVP | Month 6 | Asset Management + GIS (pilot region) |
| R2 | Production v1.0 | Month 16 | Full monitoring, alarms, health, maintenance, inspections |
| R3 | Production v2.0 | Month 24 | Predictive maintenance, AI Copilot, full analytics |

---

## 2. MVP Definition (Release 1 – Month 6)

### 2.1 MVP Goal
Deliver a functional asset registry with GIS visualization for a **pilot region** (100 substations, ~2,000 towers, ~500 km lines) to validate architecture, data migration, and user adoption before scaling.

### 2.2 MVP Scope (In)

| Module | MVP Capability |
|--------|---------------|
| **Asset Registry** | CRUD, hierarchy, search, bulk import, QR codes |
| **GIS** | Lines, towers, substations on ArcGIS/OSM; click-to-detail |
| **Identity** | Azure AD SSO, MFA, RBAC (Admin, Asset Engineer, Ops Engineer) |
| **Administration** | User/role management, audit logs |
| **Data Migration** | Pilot region asset data loaded and validated |

### 2.3 MVP Scope (Out — Production Release 1)

These remain **out of the formal MVP release gate** even though prototype APIs exist for UX demos:

| Module | Deferred To | Prototype note |
|--------|-------------|----------------|
| Real-time monitoring / SCADA | Release 2 (Phase 2) | Mock/heuristic data only |
| Production alarm notifications (Email/SMS/Teams) | Release 2 | In-app API only |
| Sensor-backed health scores | Release 2 (Phase 3) | Heuristic scores in prototype |
| EAM-integrated work orders | Release 2 (Phase 3) | Local CRUD in prototype |
| Mobile field inspections | Release 2 (Phase 3) | Web portal only |
| Predictive maintenance | Release 3 (Phase 4) | Heuristic recommendations |
| Mobile app | Release 2 (Phase 3) | — |
| AI Copilot | Release 3 (Phase 5) | — |
| EAM integration | Release 2 (Phase 4) | — |
| Reporting engine (PDF) | Release 2 (Phase 4) | — |

### 2.4 MVP Success Criteria

| # | Criterion | Metric |
|---|-----------|--------|
| 1 | Pilot region assets registered | 100% of 100 substations, 2,000 towers |
| 2 | GIS map displays all pilot assets | 100% with correct coordinates |
| 3 | User adoption | 20+ active users in pilot region |
| 4 | System uptime during pilot | ≥ 99.5% |
| 5 | API response time | p95 < 500 ms |
| 6 | User satisfaction | ≥ 4.0/5.0 (post-MVP survey) |
| 7 | Zero critical security findings | Pen test passed |
| 8 | Data migration accuracy | ≥ 99% match with source EAM |

### 2.5 MVP Architecture (Minimal)

```
React/MUI Frontend (Static Web App)
    → APIM → Asset Service + GIS Service (.NET 8)
    → Azure SQL (assets, users, audit)
    → Blob Storage (QR codes)
    → Entra ID (auth)
```

**Not in MVP:** IoT Hub, ADX, Redis, SignalR, ML, Service Bus

### 2.6 MVP Pilot Plan

| Week | Activity |
|------|----------|
| W1–W2 | Deploy MVP to staging; UAT with 5 asset engineers |
| W3 | Data migration validation; fix data quality issues |
| W4 | Deploy to production; onboard 20 pilot users |
| W5–W8 | Pilot operation; collect feedback; daily standups with users |
| W9 | MVP retrospective; go/no-go for Phase 2 |

### 2.7 Prototype Codebase Alignment (July 2026)

The FastAPI + Next.js prototype **ahead of production MVP** includes functional modules for pilot UX validation. These are **not** production-ready (no Azure AD, no pen test, no EAM migration):

| Module | Prototype (`IMPLEMENTATION.md`) | Production MVP gate |
|--------|----------------------------------|---------------------|
| Asset Registry | ✅ CRUD, search, hierarchy API | Requires pilot data migration + QR |
| GIS | ✅ Map + GeoJSON API | Requires ArcGIS enterprise basemaps |
| Alarms | ✅ List, acknowledge, close | Requires SCADA-driven generation in R2 |
| Health | ✅ Portfolio scores | Requires sensor-backed scoring in R2 |
| Maintenance | ✅ Work orders | Requires EAM integration in R2 |
| Inspections | ✅ Records API + UI | Requires mobile capture in R2 |
| Identity (Azure AD) | ❌ Not implemented | Required for MVP release |
| Real-time SCADA | ❌ Not implemented | Release 2 |

---

## 3. Production Release v1.0 (Release 2 – Month 16)

### 3.1 Goal
Full operational platform for all 500+ substations with real-time monitoring, alarm management, condition monitoring, maintenance, inspections, and mobile app.

### 3.2 Scope

| Module | Capability |
|--------|------------|
| All MVP features | Scaled to all regions |
| Real-Time Monitoring | SCADA/IoT ingestion for 500+ substations; live dashboards |
| Alarm Management | Full lifecycle, escalation, Email/SMS/Teams notifications |
| Condition Monitoring | Daily health scores, risk assessment, RUL |
| Maintenance | Work orders (PM, PdM, CM, EM), scheduling, history |
| Inspections | Manual, drone, thermal; AI image analysis |
| GIS | Fault overlay, crew tracking, risk heatmap |
| Mobile App v1 | Asset lookup, inspections, offline mode |
| Analytics | Operations, maintenance, engineering dashboards |
| EAM Integration | Bidirectional asset and work order sync |

### 3.3 Rollout Strategy

```
Month 12: Release to staging (all modules)
Month 13: UAT with operations, maintenance, and field teams
Month 14: Phased rollout:
    Week 1–2: Region A (150 substations)
    Week 3–4: Region B (150 substations)
    Week 5–6: Region C (150 substations)
    Week 7–8: Region D (remaining)
Month 15: Hypercare (24/7 support, daily monitoring)
Month 16: Production v1.0 declared; transition to BAU support
```

### 3.4 Production v1.0 Success Criteria

| # | Criterion | Metric |
|---|-----------|--------|
| 1 | All substations connected | 500+ substations ingesting data |
| 2 | Sensor ingestion | ≥ 1M records/day sustained |
| 3 | Alarm response | Critical alarms acknowledged < 5 min (avg) |
| 4 | Health scores | 100% critical assets scored daily |
| 5 | PM compliance tracking | PM dashboard operational |
| 6 | Mobile adoption | 100+ field technicians using mobile app |
| 7 | Uptime | 99.9% over 30-day hypercare period |
| 8 | SAIDI/SAIFI tracking | KPI dashboards live with baseline data |

---

## 4. Production Release v2.0 (Release 3 – Month 24)

### 4.1 Goal
AI-powered predictive maintenance, full analytics suite, reporting engine, AI Copilot, and WhatsApp integration.

### 4.2 Scope

| Module | Capability |
|--------|------------|
| All v1.0 features | Stable and optimized |
| Predictive Maintenance | Failure prediction, RUL, ranked recommendations |
| Anomaly Detection | Real-time ML-based sensor anomaly detection |
| Analytics | Executive dashboards, SAIDI/SAIFI/MTBF/MTTR |
| Reporting | PDF/Excel/CSV reports, scheduled delivery |
| Mobile App v2 | Work order execution, digital sign-off |
| AI Copilot | Natural language queries, alarm triage, report narratives |
| WhatsApp | Critical alarm notifications |
| EAM Integration | Full bidirectional sync |

### 4.3 Success Criteria

| # | Criterion | Metric |
|---|-----------|--------|
| 1 | ML model precision | ≥ 75% on transformer failure prediction |
| 2 | PdM adoption | ≥ 40% of maintenance WOs from predictions |
| 3 | AI Copilot usage | 50+ daily active users |
| 4 | Report generation | All 7 report types operational |
| 5 | Full platform uptime | 99.9% over 90 days |
| 6 | Business KPI impact | SAIDI reduced 10%+ from baseline |

---

## 5. Release Management Process

### 5.1 Release Cadence

| Type | Frequency | Content |
|------|-----------|---------|
| Major Release | Per phase gate (M6, M16, M24) | New modules, architecture changes |
| Minor Release | Monthly | Features, enhancements, bug fixes |
| Patch Release | As needed (hotfix) | Critical bug fixes, security patches |

### 5.2 Release Pipeline

```
Feature Branch → PR → CI (build, test, scan) → Merge to develop
    → Deploy to Dev (auto)
    → Deploy to QA (auto on release branch)
    → UAT Sign-off
    → Deploy to Staging (manual approval)
    → Smoke Tests + Performance Tests
    → Change Advisory Board Approval
    → Deploy to Production (blue-green)
    → Smoke Tests
    → Monitor (24h hypercare for major releases)
```

### 5.3 Rollback Strategy

| Scenario | Action |
|----------|--------|
| Failed deployment | Automatic rollback to previous container image (blue-green) |
| Database migration failure | Restore from pre-migration snapshot; fix and retry |
| Critical bug in production | Hotfix branch → expedited pipeline → patch release within 4 hours |
| Data corruption | Point-in-time restore (SQL: 35-day window) |

---

## 6. Environment Strategy

| Environment | Purpose | Data | URL Pattern |
|-------------|---------|------|-------------|
| Dev | Developer testing | Synthetic | dev.tams.internal |
| QA | Automated + manual testing | Anonymized subset | qa.tams.internal |
| Staging | Pre-production validation | Prod mirror (weekly) | staging.tams.internal |
| Production | Live operations | Live | tams.utility.com |
| DR | Disaster recovery standby | Replicated | dr.tams.internal |

---

## 7. Migration from Prototype

The current repository contains a **Phase 1 prototype** (FastAPI + Next.js + PostgreSQL). Migration to the target .NET 8 + Azure architecture follows:

| Prototype Component | Target Component | Migration Approach |
|--------------------|--------------------|--------------------|
| FastAPI backend | .NET 8 Web API | Rewrite services; port business logic |
| PostgreSQL + PostGIS | Azure SQL + spatial | Schema migration; ETL scripts |
| Next.js + Tailwind | React + Material UI | UI redesign per UX guide |
| Redis/Celery | Azure Service Bus + Functions | Replace task queue |
| AWS S3 | Azure Blob Storage | AzCopy migration |
| Mapbox/Cesium GIS | ArcGIS + OSM + Cesium | Layer reconfiguration |
| ML (PyTorch/YOLO) | Azure ML + Custom Vision | Model re-export and redeploy |

**Parallel Run:** Prototype and MVP run in parallel for 3 months (M4–M6) during pilot to validate data parity.

---

## 8. Training & Change Management

| Audience | Training | Timing |
|----------|----------|--------|
| Operations Engineers | Dashboard, alarms, GIS (4 hours) | 2 weeks before rollout |
| Maintenance Engineers | Work orders, scheduling (3 hours) | 2 weeks before rollout |
| Asset Engineers | Health scores, inspections, risk (4 hours) | 2 weeks before rollout |
| Field Technicians | Mobile app, QR scan, offline (2 hours) | 1 week before rollout |
| Executives | Dashboard overview (1 hour) | 1 week before rollout |
| Administrators | User management, config (4 hours) | 3 weeks before rollout |

**Materials:** User guides, video tutorials, in-app tooltips, quick reference cards

---

## 9. Support Model (Post-Release)

| Period | Support Level | Coverage |
|--------|--------------|----------|
| Hypercare (4 weeks post-release) | 24/7 war room | All teams on standby |
| Stabilization (Months 1–3 post-release) | Extended hours (6 AM – 10 PM) | L2 + L3 support |
| BAU (Month 4+) | Business hours L2; 24/7 L1 (NOC) | Standard ITIL support |

| Tier | Responsibility | Response SLA |
|------|---------------|-------------|
| L1 | NOC / Help Desk | 15 min (Critical), 1 hour (High) |
| L2 | TAMS Application Support | 30 min (Critical), 2 hours (High) |
| L3 | Development Team | 1 hour (Critical), 4 hours (High) |
| L4 | Vendor (Azure, ArcGIS) | Per vendor SLA |

---

## 10. Key Decision Gates

| Gate | Month | Decision | Approvers |
|------|-------|----------|-----------|
| G1: MVP Go/No-Go | M5 | Proceed to MVP pilot? | Steering Committee |
| G2: Phase 2 Start | M6 | MVP successful? Begin SCADA integration? | Steering Committee + OT Lead |
| G3: Production v1.0 Go/No-Go | M15 | Full rollout approved? | Steering Committee |
| G4: Phase 4 Start | M16 | Production stable? Begin ML development? | Steering Committee + Data Science Lead |
| G5: Full Release | M23 | Platform complete? Transition to BAU? | Steering Committee |

---

**Maintained By:** Release Management Team

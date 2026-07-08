# Product Backlog
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-BACKLOG-001  
**Version:** 1.0  
**Date:** July 2026

---

## Backlog Structure

```
Epic → Feature → User Story → Acceptance Criteria
```

**Priority:** P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)  
**Estimate:** Story Points (Fibonacci: 1, 2, 3, 5, 8, 13)

---

## Prototype Implementation Status (July 2026)

| Epic | Prototype | Production MVP |
|------|-----------|----------------|
| Epic 1 — Asset Registry | ✅ Partial (CRUD, search; no bulk import/QR) | Full per release gate |
| Epic 2 — GIS | ✅ Map + click-to-detail + GeoJSON API | ArcGIS enterprise basemaps |
| Epic 3 — Real-Time Monitoring | ❌ | Release 2 |
| Epic 4 — Alarm Management | ✅ API + UI (no external notifications) | Release 2 with SCADA |
| Epic 5+ — Health, Maintenance, Inspections | ✅ API + MUI pages | EAM/mobile in Release 2 |

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for endpoint and route details.

---

## Epic 1: Asset Registry (Phase 1)

### Feature 1.1: Asset Master Data Management

| ID | User Story | Priority | Points | Sprint |
|----|-----------|----------|--------|--------|
| US-1.1.1 | As an Asset Engineer, I want to create a new asset with all required attributes so that it is registered in the system | P0 | 5 | S3 |
| US-1.1.2 | As an Asset Engineer, I want to edit asset attributes so that I can keep records up to date | P0 | 3 | S3 |
| US-1.1.3 | As an Asset Engineer, I want to deactivate an asset so that decommissioned equipment is excluded from monitoring | P1 | 2 | S4 |
| US-1.1.4 | As an Operations Engineer, I want to search assets by code, type, location, and tags so that I can quickly find equipment | P0 | 5 | S4 |
| US-1.1.5 | As an Asset Engineer, I want to bulk import assets from Excel/CSV so that I can migrate existing data efficiently | P0 | 8 | S5 |
| US-1.1.6 | As an Administrator, I want to configure asset types and categories so that the taxonomy matches our utility standards | P1 | 5 | S3 |

**Acceptance Criteria (US-1.1.1) — prototype status:**
- [x] Asset created with unique AssetCode *(prototype)*
- [x] Validation rejects duplicate codes *(prototype)*
- [x] Required fields enforced (code, type, criticality) *(partial — not all enterprise fields)*
- [ ] Audit log entry created *(production MVP)*
- [x] API returns 201 with created asset *(prototype)*

### Feature 1.2: Asset Hierarchy

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-1.2.1 | As an Asset Engineer, I want to define parent-child relationships so that I can model substation → bay → equipment hierarchy | P0 | 5 |
| US-1.2.2 | As an Operations Engineer, I want to view the asset hierarchy tree so that I can navigate equipment structure | P0 | 3 |
| US-1.2.3 | As a System, I must prevent circular hierarchy references | P0 | 3 |

### Feature 1.3: QR Code Management

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-1.3.1 | As an Asset Engineer, I want to generate a QR code for an asset so that field technicians can scan it | P1 | 3 |
| US-1.3.2 | As a Field Technician, I want to scan a QR code to open the asset detail page on mobile | P1 | 5 |
| US-1.3.3 | As an Asset Engineer, I want to print QR labels in batch so that I can label physical equipment | P2 | 5 |

### Feature 1.4: Asset Lifecycle

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-1.4.1 | As an Asset Engineer, I want to track asset lifecycle states so that I know if equipment is planned, in-service, or decommissioned | P1 | 3 |
| US-1.4.2 | As an Auditor, I want to view the lifecycle history of an asset so that I can verify state transitions | P2 | 3 |

---

## Epic 2: GIS Module (Phase 1)

### Feature 2.1: Map Visualization

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-2.1.1 | As an Operations Engineer, I want to view transmission lines on a map so that I can see network topology | P0 | 8 |
| US-2.1.2 | As an Operations Engineer, I want to view towers and substations on a map so that I can locate physical assets | P0 | 5 |
| US-2.1.3 | As an Operations Engineer, I want to toggle map layers on/off so that I can focus on relevant data | P1 | 3 |
| US-2.1.4 | As an Operations Engineer, I want to click an asset on the map to view its details | P0 | 3 |
| US-2.1.5 | As an Operations Engineer, I want to switch between ArcGIS, Google Maps, and OSM basemaps | P1 | 5 |

### Feature 2.2: Geospatial Analytics

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-2.2.1 | As an Asset Engineer, I want to find all assets within a radius of a point so that I can assess proximity risk | P1 | 5 |
| US-2.2.2 | As an Operations Engineer, I want to see fault locations on the map so that I can dispatch crews | P0 | 5 |
| US-2.2.3 | As a Manager, I want to view a risk heatmap overlay so that I can identify high-risk corridors | P1 | 8 |

---

## Epic 3: Real-Time Monitoring (Phase 2)

### Feature 3.1: Sensor Data Ingestion

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-3.1.1 | As a System, I must ingest SCADA telemetry via IoT Hub so that sensor data is available for monitoring | P0 | 13 |
| US-3.1.2 | As a System, I must normalize DNP3, Modbus, and IEC 61850 data into a canonical format | P0 | 13 |
| US-3.1.3 | As a System, I must store sensor readings in ADX for time-series queries | P0 | 8 |
| US-3.1.4 | As an Administrator, I want to register sensors against assets so that telemetry is correctly mapped | P0 | 5 |

### Feature 3.2: Live Dashboards

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-3.2.1 | As an Operations Engineer, I want to view live transformer parameters so that I can monitor equipment health | P0 | 8 |
| US-3.2.2 | As an Operations Engineer, I want to view live line parameters including sag and conductor temperature | P0 | 8 |
| US-3.2.3 | As an Operations Engineer, I want dashboards to auto-refresh every 5 seconds so that I see current data | P0 | 5 |
| US-3.2.4 | As an Operations Engineer, I want to view historical trends for any sensor over configurable time ranges | P0 | 8 |
| US-3.2.5 | As an Operations Engineer, I want to see an event timeline correlating alarms, SCADA events, and maintenance | P1 | 8 |

---

## Epic 4: Alarm Management (Phase 2)

### Feature 4.1: Alarm Lifecycle

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-4.1.1 | As a System, I must generate alarms when sensor thresholds are breached | P0 | 8 |
| US-4.1.2 | As an Operations Engineer, I want to acknowledge an alarm with notes so that the team knows it is being handled | P0 | 3 |
| US-4.1.3 | As an Operations Engineer, I want to close an alarm with closure notes so that the incident is documented | P0 | 3 |
| US-4.1.4 | As an Auditor, I want to view the complete audit history of an alarm so that I can verify handling | P0 | 3 |
| US-4.1.5 | As an Administrator, I want to configure alarm rules and thresholds per sensor type | P0 | 8 |

### Feature 4.2: Escalation & Notification

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-4.2.1 | As a System, I must escalate unacknowledged critical alarms after 5 minutes | P0 | 8 |
| US-4.2.2 | As an Operations Engineer, I want to receive alarm notifications via Microsoft Teams | P0 | 5 |
| US-4.2.3 | As an Operations Engineer, I want to receive critical alarm SMS notifications | P0 | 5 |
| US-4.2.4 | As an Administrator, I want to configure the escalation matrix by role and severity | P1 | 5 |
| US-4.2.5 | As an Operations Engineer, I want to receive WhatsApp notifications for critical alarms | P2 | 5 |

---

## Epic 5: Condition Monitoring (Phase 3)

### Feature 5.1: Health Index

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-5.1.1 | As a System, I must compute daily health scores for all in-service assets | P0 | 13 |
| US-5.1.2 | As an Asset Engineer, I want to view the health score breakdown by factor so that I understand what drives the score | P0 | 5 |
| US-5.1.3 | As an Asset Engineer, I want to view health score trends over time so that I can detect degradation | P0 | 5 |
| US-5.1.4 | As a Manager, I want to view the portfolio health distribution so that I can assess overall network condition | P1 | 5 |

### Feature 5.2: Risk Assessment

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-5.2.1 | As an Asset Engineer, I want to view risk scores with probability and impact breakdown | P0 | 5 |
| US-5.2.2 | As a Manager, I want to view the top 10 at-risk assets so that I can prioritize interventions | P0 | 3 |
| US-5.2.3 | As an Executive, I want to view a regional risk heatmap so that I can allocate budget | P1 | 8 |

---

## Epic 6: Maintenance Management (Phase 3)

### Feature 6.1: Work Orders

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-6.1.1 | As a Maintenance Engineer, I want to create a work order for an asset so that maintenance is scheduled | P0 | 5 |
| US-6.1.2 | As a Maintenance Engineer, I want to assign a work order to a crew so that work is delegated | P0 | 3 |
| US-6.1.3 | As a Field Technician, I want to view my assigned work orders on mobile so that I know my tasks | P0 | 5 |
| US-6.1.4 | As a Field Technician, I want to complete a work order with notes and photos so that work is documented | P0 | 8 |
| US-6.1.5 | As a Maintenance Engineer, I want to create a work order from an alarm in one click so that response is fast | P0 | 3 |
| US-6.1.6 | As a Maintenance Engineer, I want to track spare parts used on a work order so that inventory is updated | P1 | 5 |

---

## Epic 7: Inspection Management (Phase 3)

### Feature 7.1: Inspection Workflow

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-7.1.1 | As an Asset Engineer, I want to schedule an inspection for an asset so that it is planned | P0 | 3 |
| US-7.1.2 | As a Field Technician, I want to submit an inspection with photos and observations on mobile | P0 | 8 |
| US-7.1.3 | As an Asset Engineer, I want to upload drone inspection images and videos so that aerial data is captured | P0 | 5 |
| US-7.1.4 | As a System, I must trigger AI image analysis on uploaded inspection photos | P1 | 13 |
| US-7.1.5 | As an Asset Engineer, I want to review AI-detected defects with confidence scores so that I can validate findings | P1 | 5 |

---

## Epic 8: Predictive Maintenance (Phase 4)

### Feature 8.1: ML Predictions

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-8.1.1 | As a System, I must generate failure predictions for transformers with confidence scores | P0 | 13 |
| US-8.1.2 | As an Asset Engineer, I want to view RUL estimates for critical assets so that I can plan replacements | P0 | 8 |
| US-8.1.3 | As a Maintenance Engineer, I want to view ranked maintenance recommendations so that I can prioritize work | P0 | 5 |
| US-8.1.4 | As a Maintenance Engineer, I want to convert a recommendation to a work order so that action is taken | P0 | 3 |
| US-8.1.5 | As a System, I must detect real-time sensor anomalies using ML models | P1 | 13 |

---

## Epic 9: Analytics & Reporting (Phase 4)

### Feature 9.1: Dashboards

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-9.1.1 | As an Operations Engineer, I want an operations dashboard with active alarms and load trends | P0 | 8 |
| US-9.1.2 | As a Maintenance Engineer, I want a maintenance dashboard with WO queue and PM compliance | P0 | 5 |
| US-9.1.3 | As an Executive, I want an executive dashboard with SAIDI, SAIFI, availability, and risk summary | P0 | 8 |

### Feature 9.2: Reports

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-9.2.1 | As a Manager, I want to generate an Asset Health report in PDF so that I can share with leadership | P0 | 8 |
| US-9.2.2 | As an Auditor, I want to generate a Regulatory Compliance report so that I can verify compliance | P0 | 8 |
| US-9.2.3 | As a Manager, I want to export KPI data to Excel so that I can perform custom analysis | P1 | 5 |
| US-9.2.4 | As a Manager, I want to schedule automated monthly report delivery via email | P2 | 5 |

---

## Epic 10: Identity & Administration (Phase 1)

### Feature 10.1: Authentication & RBAC

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-10.1.1 | As a User, I want to sign in with my corporate Microsoft account so that I use SSO | P0 | 5 |
| US-10.1.2 | As a System, I must enforce MFA for all users | P0 | 3 |
| US-10.1.3 | As an Administrator, I want to assign roles to users so that access is controlled | P0 | 5 |
| US-10.1.4 | As a System, I must enforce RBAC on all API endpoints | P0 | 8 |

### Feature 10.2: Audit & Configuration

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-10.2.1 | As an Auditor, I want to search audit logs by user, action, and date range | P0 | 5 |
| US-10.2.2 | As an Administrator, I want to configure notification templates | P1 | 3 |
| US-10.2.3 | As an Administrator, I want to configure alarm escalation rules | P1 | 5 |

---

## Epic 11: Mobile Application (Phase 3–4)

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-11.1 | As a Field Technician, I want to use the app offline and sync when connected | P0 | 13 |
| US-11.2 | As a Field Technician, I want GPS coordinates auto-tagged on photos | P0 | 3 |
| US-11.3 | As a Field Technician, I want push notifications for new work orders and alarms | P0 | 5 |
| US-11.4 | As a Field Technician, I want to digitally sign off completed work orders | P1 | 5 |

---

## Epic 12: AI Copilot (Phase 5)

| ID | User Story | Priority | Points |
|----|-----------|----------|--------|
| US-12.1 | As an Operations Engineer, I want to ask natural language questions about assets and alarms | P1 | 13 |
| US-12.2 | As an Executive, I want the Copilot to generate narrative summaries for reports | P2 | 8 |
| US-12.3 | As an Operations Engineer, I want the Copilot to suggest root causes for alarms | P1 | 13 |

---

## Backlog Summary

| Epic | Features | Stories | Total Points | Phase |
|------|----------|---------|-------------|-------|
| E1: Asset Registry | 4 | 14 | 55 | 1 |
| E2: GIS | 2 | 8 | 42 | 1 |
| E3: Real-Time Monitoring | 2 | 9 | 68 | 2 |
| E4: Alarm Management | 2 | 10 | 48 | 2 |
| E5: Condition Monitoring | 2 | 7 | 36 | 3 |
| E6: Maintenance | 1 | 6 | 29 | 3 |
| E7: Inspection | 1 | 5 | 31 | 3 |
| E8: Predictive | 1 | 5 | 42 | 4 |
| E9: Analytics & Reports | 2 | 7 | 39 | 4 |
| E10: Identity & Admin | 2 | 7 | 34 | 1 |
| E11: Mobile | 1 | 4 | 26 | 3–4 |
| E12: AI Copilot | 1 | 3 | 34 | 5 |
| **Total** | **21** | **85** | **484** | |

**Velocity Assumption:** 30–35 points/sprint (2-week sprint) → ~14–16 sprints (~7–8 months) for P0 items

---

**Maintained By:** Product Owner

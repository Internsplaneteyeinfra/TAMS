# Software Requirements Specification (SRS)
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-SRS-001  
**Version:** 1.0  
**Date:** July 2026  
**Reference:** TAMS-BRD-001

---

## 1. Introduction

### 1.1 Purpose
This SRS defines the functional and non-functional software requirements for TAMS, enabling development, testing, and acceptance against agreed specifications.

### 1.2 Scope
TAMS covers asset registry, real-time monitoring, condition monitoring, alarm management, predictive maintenance, maintenance management, GIS, inspection management, analytics, reporting, mobile application, and administration for transmission utility operations.

### 1.3 Definitions
See BRD Section 14 (Glossary).

### 1.4 References
- TAMS-BRD-001 Business Requirements Document
- IEC 61970/61968 (CIM standards)
- IEC 62443 (Industrial cybersecurity)
- IEEE 1366 (Reliability indices)

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                             │
│  Web App (React/MUI) │ Mobile App (React Native) │ Admin Portal       │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTPS / WSS
┌───────────────────────────────────▼─────────────────────────────────────┐
│                         API GATEWAY (Azure APIM)                         │
│              Auth (Entra ID) │ Rate Limit │ WAF │ Routing               │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────┐
│                    .NET 8 MICROSERVICES LAYER                          │
│ Asset │ Monitoring │ Alarms │ Health │ Maintenance │ Inspection │ GIS │
│ Analytics │ Predictive │ Notification │ Report │ Identity │ Audit    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
┌───────────────┬───────────────────┼───────────────────┬─────────────────┐
│ Azure SQL     │ Azure Data        │ Azure Blob        │ Azure Service   │
│ Server        │ Explorer (ADX)    │ Storage           │ Bus             │
└───────────────┴───────────────────┴───────────────────┴─────────────────┘
                                    ▲
┌───────────────────────────────────┴─────────────────────────────────────┐
│                    INGESTION LAYER                                       │
│  Azure IoT Hub │ Event Hub │ Azure Functions │ Protocol Adapters        │
│  (SCADA/RTU/IoT/DNP3/IEC61850/Modbus/OPC-UA)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Functional Module Specifications

### 3.1 Asset Registry Module

#### 3.1.1 Data Model
Each asset record SHALL contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| AssetId | GUID | Yes | System-generated unique identifier |
| AssetCode | string(50) | Yes | Business asset tag (e.g., SS-401-TX-01) |
| AssetCategory | enum | Yes | Substation, Line, Tower, Transformer, Breaker, Relay, etc. |
| AssetTypeId | FK | Yes | Reference to AssetTypes |
| Manufacturer | string(200) | No | OEM name |
| SerialNumber | string(100) | No | Manufacturer serial |
| InstallationDate | date | No | Commissioning date |
| WarrantyExpiryDate | date | No | Warranty end |
| VoltageLevel_kV | decimal | No | Nominal voltage |
| CapacityRating | decimal | No | MVA / A / kVAr per type |
| Latitude | decimal(9,6) | No | WGS84 |
| Longitude | decimal(9,6) | No | WGS84 |
| Elevation_m | decimal | No | Meters AMSL |
| Status | enum | Yes | Planned, Installed, InService, Maintenance, Decommissioned |
| Criticality | enum | Yes | Critical, High, Medium, Low |
| ParentAssetId | FK | No | Hierarchy parent |
| SubstationId | FK | No | Owning substation |
| Tags | string[] | No | Searchable tags |
| QRCodeUrl | string | No | Generated QR image URL |
| Metadata | JSON | No | Extensible attributes |

#### 3.1.2 Functional Behaviors
- Create, read, update, deactivate assets (no hard delete)
- Navigate asset hierarchy tree (unlimited depth)
- Bulk import via Excel/CSV with validation report
- Generate QR codes linking to asset detail page
- Track lifecycle state transitions with audit log
- Search by code, type, location, tags, criticality, status

---

### 3.2 Real-Time Monitoring Module

#### 3.2.1 Monitored Parameters

**Transformers**

| Parameter | Unit | Typical Source | Alarm Threshold Example |
|-----------|------|----------------|------------------------|
| OilTemperature | °C | RTU/IoT | > 85°C High |
| WindingTemperature | °C | RTU/IoT | > 105°C Critical |
| Load | MVA | SCADA | > 90% rated Critical |
| Voltage | kV | SCADA | ±5% nominal High |
| Current | A | SCADA | > rated High |
| DGA_H2 | ppm | DGA analyzer | Trend anomaly Critical |
| DGA_C2H2 | ppm | DGA analyzer | > 5 ppm Critical |
| OilLevel | % | Sensor | < 80% Medium |

**Transmission Lines**

| Parameter | Unit | Source |
|-----------|------|--------|
| Current | A | SCADA/PMU |
| Voltage | kV | SCADA/PMU |
| Sag | m | IoT/dynamic rating |
| ConductorTemperature | °C | IoT |
| WindSpeed | m/s | Weather API |
| AmbientTemperature | °C | Weather API |

**Circuit Breakers**

| Parameter | Unit | Source |
|-----------|------|--------|
| OperationsCount | count | SCADA |
| SF6Pressure | bar | Sensor |
| ContactWear | % | Calculated |
| TripStatus | enum | SCADA |

**Relays**

| Parameter | Source |
|-----------|--------|
| RelayStatus | SCADA/IEC61850 |
| EventLogs | Relay export |
| FaultRecords | Fault recorder |

**Substations**

| Parameter | Unit |
|-----------|------|
| BusVoltage | kV |
| Frequency | Hz |
| EnergyFlow | MWh |
| Demand | MW |

#### 3.2.2 Display Requirements
- Real-time dashboard with configurable widgets per asset type
- Trend charts: 1h, 24h, 7d, 30d, 1y, custom range
- Historical analysis with ADX Kusto queries
- Event timeline correlating alarms, SCADA events, maintenance
- WebSocket/SignalR push for live value updates (< 5s refresh)

---

### 3.3 Condition Monitoring Module

#### 3.3.1 Health Index Formula

```
HealthScore = Σ (Wi × Fi)  where Σ Wi = 1.0

Factors:
  F1: Age Factor         W1 = 0.15  (based on expected life vs actual age)
  F2: Loading Factor     W2 = 0.20  (avg load / rated capacity)
  F3: Inspection Score   W3 = 0.20  (latest inspection rating 0-100)
  F4: Failure History    W4 = 0.15  (incidents in last 5 years)
  F5: Sensor Health      W5 = 0.10  (data quality/completeness)
  F6: Criticality Score  W6 = 0.20  (inverse: higher criticality = lower health buffer)
```

#### 3.3.2 Output Scores

| Score | Range | Description |
|-------|-------|-------------|
| HealthScore | 0–100 | Overall asset health (100 = excellent) |
| ConditionScore | 1–5 | C1 (Excellent) to C5 (Critical) per IEEE/IEC convention |
| RiskScore | 0–100 | Probability × Impact composite |
| RUL | months | Remaining useful life estimate |

#### 3.3.3 Processing
- Batch computation: daily at 02:00 local time
- Event-triggered recalculation on: new inspection, failure, alarm closure, significant load change
- Store historical scores for trending (ADX + SQL snapshot)

---

### 3.4 Alarm Management Module

#### 3.4.1 Alarm Lifecycle

```
[Generated] → [Active] → [Acknowledged] → [In Progress] → [Closed]
                  ↓              ↓
              [Suppressed]   [Escalated]
```

#### 3.4.2 Severity Matrix

| Severity | Color | Default Escalation | Response SLA |
|----------|-------|-------------------|--------------|
| Critical | Red | 5 min → SMS + Teams | 15 min |
| High | Orange | 15 min → Email + Teams | 1 hour |
| Medium | Yellow | 1 hour → Email | 4 hours |
| Low | Blue | 24 hours → Dashboard only | 24 hours |

#### 3.4.3 Notification Channels
- Email (SendGrid / Azure Communication Services)
- SMS (Azure Communication Services)
- Mobile Push (Firebase/APNs via Notification Hubs)
- Microsoft Teams (Webhook / Graph API)
- WhatsApp (Twilio Business API integration)

#### 3.4.4 Escalation Matrix (Configurable)
| Level | Role | Delay | Channels |
|-------|------|-------|----------|
| L1 | On-call Operations Engineer | 0 min | Dashboard, Teams |
| L2 | Backup Engineer | 5 min | SMS, Teams |
| L3 | Control Center Manager | 15 min | SMS, Email, Teams |
| L4 | VP Operations | 30 min | SMS, Email |

---

### 3.5 Predictive Maintenance Module

#### 3.5.1 AI Capabilities
| Capability | Model Type | Output |
|------------|------------|--------|
| Failure Prediction | Gradient Boosting / XGBoost | Failure probability (0–1) |
| Degradation Forecast | LSTM / Prophet | Trend curve 30/90/365 days |
| RUL Prediction | Survival Analysis / Regression | Months remaining |
| Maintenance Recommendation | Rule Engine + ML Ranking | Priority queue |

#### 3.5.2 Recommendation Record
```json
{
  "assetId": "guid",
  "recommendationType": "Inspection|Maintenance|Replacement",
  "confidenceScore": 0.87,
  "riskProbability": 0.72,
  "priorityRank": 3,
  "recommendedAction": "Schedule DGA analysis within 14 days",
  "estimatedCost": 15000,
  "rulMonths": 18,
  "modelVersion": "tx-failure-v2.1",
  "generatedAt": "2026-07-06T10:00:00Z"
}
```

---

### 3.6 Maintenance Management Module

#### 3.6.1 Maintenance Types
| Type | Code | Trigger |
|------|------|---------|
| Preventive | PM | Calendar/usage schedule |
| Predictive | PdM | ML recommendation |
| Corrective | CM | Failure/defect |
| Emergency | EM | Critical alarm/outage |

#### 3.6.2 Work Order States
`Draft → Approved → Scheduled → Assigned → InProgress → Completed → Closed → Cancelled`

#### 3.6.3 Work Order Fields
- WorkOrderNumber, AssetId, Type, Priority, Description
- AssignedCrew, ScheduledStart/End, ActualStart/End
- SpareParts[], LaborHours, Cost, RootCause, CompletionNotes
- Attachments[], SignOff (digital signature)

---

### 3.7 GIS Module

#### 3.7.1 Map Providers
| Provider | Use Case | Integration |
|----------|----------|-------------|
| ArcGIS Enterprise | Primary utility basemap, asset layers | ArcGIS REST JS API |
| Google Maps | Street view, routing for crews | Maps JavaScript API |
| OpenStreetMap | Fallback / offline tiles | Leaflet |

#### 3.7.2 Layers
- Transmission lines (polyline, voltage color-coded)
- Towers (point markers with structure type icon)
- Substations (polygon/point with boundary)
- Fault locations (pulsing red marker)
- Active alarms (severity-colored)
- Maintenance crews (live GPS from mobile app)
- Risk heatmap (raster/choropleth)
- Inspection corridors (buffer zones)

#### 3.7.3 Geospatial Analytics
- Proximity analysis (assets within radius of fault)
- Corridor vegetation risk overlay
- Spatial query: assets in bounding box / polygon
- Route optimization for crew dispatch

---

### 3.8 Inspection Management Module

#### 3.8.1 Inspection Types
| Type | Method | Media |
|------|--------|-------|
| Manual | Field walkthrough | Photos, notes |
| Drone | UAV flight | Images, video, orthomosaic |
| Thermal | IR camera / drone | Thermal images |
| Visual | Ground/binocular | Photos |

#### 3.8.2 Inspection Record
- InspectionId, AssetId, Type, InspectorId, ScheduledDate, CompletedDate
- Observations[], Defects[], Severity, OverallScore (0–100)
- Attachments[] (Blob Storage URLs)
- AIAnalysisResults[] (defect type, bounding box, confidence)
- ReportPdfUrl

#### 3.8.3 AI Image Analysis
- Defect classes: corrosion, insulator damage, vegetation encroachment, hot spot, structural damage, loose hardware
- Model: Azure Custom Vision / YOLOv11 deployed on Azure ML
- Output: annotated images + defect list with GPS coordinates

---

### 3.9 Analytics Dashboard Module

#### 3.9.1 Dashboard Profiles

| Profile | Primary KPIs | Refresh |
|---------|-------------|---------|
| Operations | Active alarms, load, frequency, outage map | Real-time |
| Maintenance | Open WOs, PM compliance, crew utilization | 15 min |
| Asset Engineering | Health distribution, RUL, DGA trends | Daily |
| Management | SAIDI, SAIFI, cost, risk portfolio | Daily |
| Executive | Availability, risk summary, budget vs actual | Daily |

#### 3.9.2 KPI Definitions

| KPI | Formula |
|-----|---------|
| SAIDI | Σ(Customer Interruption Duration) / Total Customers |
| SAIFI | Σ(Customer Interruptions) / Total Customers |
| MTBF | Total Operating Hours / Number of Failures |
| MTTR | Total Repair Hours / Number of Repairs |
| Asset Availability | (Total Hours - Downtime Hours) / Total Hours × 100 |
| PM Compliance | Completed PM WOs / Scheduled PM WOs × 100 |

---

## 4. External Interface Requirements

### 4.1 SCADA Integration
- Protocol adapters: IEC 61850, DNP3, Modbus TCP, OPC-UA
- Ingestion via Azure IoT Edge gateway in OT DMZ
- Message format: JSON canonical model mapped to CIM

### 4.2 EAM Integration
- Bidirectional sync: asset master, work orders, maintenance history
- Protocol: REST API or Azure Service Bus messages
- Sync frequency: assets daily; work orders near-real-time

### 4.3 GIS Integration
- ArcGIS Feature Server for asset geometry sync
- Coordinate system: WGS84 (display), utility CRS (storage)

### 4.4 Weather Integration
- Azure Maps Weather API or third-party (OpenWeather)
- Parameters: temperature, wind, precipitation, lightning

---

## 5. Non-Functional Requirements Summary

Refer to BRD Section 11. Additional software-specific requirements:

| ID | Category | Requirement |
|----|----------|-------------|
| SRS-NFR-01 | Modularity | Each module deployable as independent Azure Container App |
| SRS-NFR-02 | API Versioning | URL path versioning (/api/v1/) with 12-month deprecation notice |
| SRS-NFR-03 | Logging | Serilog structured logging; correlation ID per request |
| SRS-NFR-04 | Caching | Redis for session, dashboard cache (TTL 60s for real-time) |
| SRS-NFR-05 | Testing | 80% code coverage; integration tests for all API endpoints |

---

## 6. Traceability Matrix (Sample)

| BRD Req | SRS Module | Test Case |
|---------|------------|-----------|
| FR-01.1 | Asset Registry 3.1 | TC-ASSET-001 |
| FR-02.1 | Real-Time Monitoring 3.2 | TC-MON-001 |
| FR-03.1 | Condition Monitoring 3.3 | TC-HEALTH-001 |
| FR-04.1 | Alarm Management 3.4 | TC-ALARM-001 |
| FR-05.1 | Predictive Maintenance 3.5 | TC-PDM-001 |

---

**Document Approval**

| Role | Date |
|------|------|
| Product Owner | |
| Technical Lead | |
| QA Lead | |

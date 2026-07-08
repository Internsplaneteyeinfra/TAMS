# API Specification
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-API-001  
**Version:** 1.0  
**Base URL:** `https://api.tams.{domain}/api/v1`  
**Date:** July 2026

---

## 1. General Conventions

### 1.1 Authentication
All endpoints require Bearer token (Azure AD JWT) unless marked `[Public]`.

```
Authorization: Bearer {access_token}
```

Token obtained via MSAL OAuth 2.0 Authorization Code Flow with PKCE.

### 1.2 Response Envelope

```json
{
  "data": { },
  "meta": {
    "timestamp": "2026-07-06T10:00:00Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "version": "1.0"
  },
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 1250,
    "totalPages": 25
  }
}
```

### 1.3 Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Asset code is required",
    "details": [
      { "field": "assetCode", "message": "Required field" }
    ],
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 1.4 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (delete/deactivate) |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden (RBAC) |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 429 | Rate limited |
| 500 | Internal error |

### 1.5 Pagination & Filtering

```
GET /api/v1/assets?page=1&pageSize=50&sort=assetCode&order=asc&filter[status]=InService&filter[criticality]=Critical
```

---

## 2. Asset APIs

### GET /api/v1/assets
List assets with filtering and pagination.

**Permissions:** `Assets.Read`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | int | Page number (default 1) |
| pageSize | int | Items per page (default 50, max 200) |
| assetType | string | Filter by type code |
| category | string | Filter by category |
| status | string | Filter by status |
| criticality | string | Filter by criticality |
| substationId | int | Filter by substation |
| search | string | Full-text search on code, name, tags |
| bbox | string | Bounding box: minLon,minLat,maxLon,maxLat |

**Response 200:**
```json
{
  "data": [
    {
      "assetId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "assetCode": "SS-401-TX-01",
      "assetType": "PowerTransformer",
      "category": "Transformer",
      "manufacturer": "ABB",
      "serialNumber": "TX-2020-88421",
      "voltageLevel_kV": 400,
      "capacityRating": 315,
      "capacityUnit": "MVA",
      "latitude": 19.0760,
      "longitude": 72.8777,
      "status": "InService",
      "criticality": "Critical",
      "healthScore": 78.5,
      "substationName": "Aarey Substation"
    }
  ],
  "pagination": { "page": 1, "pageSize": 50, "totalItems": 1250, "totalPages": 25 }
}
```

---

### GET /api/v1/assets/{id}
Get asset detail with hierarchy, sensors, and latest health score.

**Permissions:** `Assets.Read`

**Response 200:**
```json
{
  "data": {
    "assetId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "assetCode": "SS-401-TX-01",
    "assetType": { "typeCode": "PowerTransformer", "typeName": "Power Transformer", "category": "Transformer" },
    "manufacturer": "ABB",
    "serialNumber": "TX-2020-88421",
    "installationDate": "2020-03-15",
    "warrantyExpiryDate": "2025-03-15",
    "voltageLevel_kV": 400,
    "capacityRating": 315,
    "latitude": 19.0760,
    "longitude": 72.8777,
    "status": "InService",
    "criticality": "Critical",
    "parentAsset": { "assetId": "...", "assetCode": "SS-401-BAY-03" },
    "children": [],
    "tags": ["400kV", "critical", "dga-enabled"],
    "qrCodeUrl": "https://storage.tams.com/qr/SS-401-TX-01.png",
    "sensors": [
      { "sensorId": "...", "parameter": "OilTemperature", "unit": "°C", "latestValue": 62.3, "latestTimestamp": "2026-07-06T09:58:00Z" }
    ],
    "healthScore": {
      "healthScore": 78.5,
      "conditionScore": 2,
      "riskScore": 35.2,
      "rulMonths": 84,
      "computedAt": "2026-07-06T02:00:00Z"
    },
    "metadata": { "coolingType": "ONAN", "tapChanger": "OLTC" }
  }
}
```

---

### POST /api/v1/assets
Create new asset.

**Permissions:** `Assets.Create`

**Request Body:**
```json
{
  "assetCode": "SS-401-TX-02",
  "assetTypeId": 1,
  "parentAssetId": null,
  "substationId": 401,
  "manufacturer": "Siemens",
  "serialNumber": "TX-2021-99102",
  "installationDate": "2021-06-01",
  "voltageLevel_kV": 400,
  "capacityRating": 500,
  "capacityUnit": "MVA",
  "latitude": 19.0765,
  "longitude": 72.8780,
  "criticality": "Critical",
  "tags": ["400kV", "new-installation"]
}
```

**Validation Rules:**
| Field | Rule |
|-------|------|
| assetCode | Required, unique, max 50 chars, pattern `^[A-Z0-9-]+$` |
| assetTypeId | Required, must exist |
| criticality | Required, enum: Critical/High/Medium/Low |
| latitude | -90 to 90 |
| longitude | -180 to 180 |
| voltageLevel_kV | > 0 |

**Response 201:** Created asset object.

---

### PUT /api/v1/assets/{id}
Update asset.

**Permissions:** `Assets.Update`

### DELETE /api/v1/assets/{id}
Deactivate asset (soft delete).

**Permissions:** `Assets.Delete`

---

### GET /api/v1/assets/{id}/hierarchy
Get full asset hierarchy tree.

**Permissions:** `Assets.Read`

### GET /api/v1/assets/{id}/qr
Generate/regenerate QR code.

**Permissions:** `Assets.Update`

---

## 3. Health & Condition APIs

### GET /api/v1/health
Portfolio health summary.

**Permissions:** `Health.Read`

**Response 200:**
```json
{
  "data": {
    "averageHealthScore": 76.3,
    "distribution": { "excellent": 3200, "good": 8500, "fair": 2100, "poor": 450, "critical": 120 },
    "topRiskAssets": [ { "assetId": "...", "assetCode": "SS-401-TX-01", "riskScore": 85.2 } ],
    "computedAt": "2026-07-06T02:00:00Z"
  }
}
```

### GET /api/v1/health/assets/{id}
Asset health detail with factor breakdown.

### GET /api/v1/health/assets/{id}/history
Health score trend.

**Query:** `from`, `to`, `interval` (daily/weekly/monthly)

---

## 4. Monitoring APIs

### GET /api/v1/monitoring/assets/{id}/live
Latest sensor values for asset.

**Permissions:** `Monitoring.Read`

**Response 200:**
```json
{
  "data": {
    "assetId": "...",
    "readings": [
      { "parameter": "OilTemperature", "value": 62.3, "unit": "°C", "timestamp": "2026-07-06T09:58:00Z", "quality": "Good" },
      { "parameter": "Load", "value": 245.7, "unit": "MVA", "timestamp": "2026-07-06T09:58:00Z", "quality": "Good" }
    ],
    "refreshInterval": 5
  }
}
```

### GET /api/v1/monitoring/sensors/{sensorId}/trends
Historical trend data.

**Query:** `from`, `to`, `aggregation` (raw/1m/5m/1h/1d)

### GET /api/v1/monitoring/assets/{id}/events
Event timeline (alarms, SCADA events, maintenance).

---

## 5. Alarm APIs

### GET /api/v1/alarms
List alarms.

**Permissions:** `Alarms.Read`

**Query:** `status`, `severity`, `assetId`, `from`, `to`, `page`, `pageSize`

**Response 200:**
```json
{
  "data": [
    {
      "alarmId": "...",
      "alarmCode": "TX-OIL-TEMP-HIGH",
      "title": "Transformer Oil Temperature High",
      "assetCode": "SS-401-TX-01",
      "severity": "High",
      "status": "Active",
      "triggerValue": 87.5,
      "thresholdValue": 85.0,
      "generatedAt": "2026-07-06T09:45:00Z",
      "escalationLevel": 1
    }
  ]
}
```

### GET /api/v1/alarms/{id}
Alarm detail with audit history.

### POST /api/v1/alarms/{id}/acknowledge
**Permissions:** `Alarms.Acknowledge`

**Request:**
```json
{ "notes": "Investigating with field team" }
```

### POST /api/v1/alarms/{id}/close
**Permissions:** `Alarms.Close`

**Request:**
```json
{ "closureNotes": "Oil cooler cleaned, temperature normalized", "createWorkOrder": true }
```

### GET /api/v1/alarms/summary
Active alarm counts by severity.

---

## 6. Work Order & Maintenance APIs

### GET /api/v1/workorders
**Permissions:** `Maintenance.Read`

### POST /api/v1/workorders
**Permissions:** `Maintenance.Create`

**Request:**
```json
{
  "assetId": "...",
  "maintenanceType": "PdM",
  "priority": "High",
  "description": "DGA analysis recommended by predictive model",
  "scheduledStart": "2026-07-15T08:00:00Z",
  "scheduledEnd": "2026-07-15T16:00:00Z",
  "assignedCrew": "Team Alpha"
}
```

### GET /api/v1/workorders/{id}
### PUT /api/v1/workorders/{id}
### POST /api/v1/workorders/{id}/assign
### POST /api/v1/workorders/{id}/complete

### GET /api/v1/maintenance/assets/{id}/history
Maintenance history for asset.

---

## 7. Inspection APIs

### GET /api/v1/inspections
### POST /api/v1/inspections
### GET /api/v1/inspections/{id}
### POST /api/v1/inspections/{id}/attachments
Upload images/videos (multipart/form-data).

### POST /api/v1/inspections/{id}/analyze
Trigger AI image analysis.

**Response 202:**
```json
{
  "data": { "analysisJobId": "...", "status": "Processing", "estimatedCompletionSeconds": 120 }
}
```

### GET /api/v1/inspections/{id}/analysis
Get AI analysis results.

---

## 8. Dashboard & Analytics APIs

### GET /api/v1/dashboard/operations
Operations dashboard data.

**Permissions:** `Dashboard.Operations`

### GET /api/v1/dashboard/maintenance
### GET /api/v1/dashboard/executive

### GET /api/v1/analytics/kpi
**Query:** `kpi` (SAIDI|SAIFI|MTBF|MTTR|Availability), `from`, `to`, `region`

**Response 200:**
```json
{
  "data": {
    "kpi": "SAIDI",
    "value": 45.2,
    "unit": "minutes",
    "trend": -12.5,
    "trendDirection": "improving",
    "period": { "from": "2025-07-01", "to": "2026-06-30" }
  }
}
```

---

## 9. Risk & Predictive APIs

### GET /api/v1/risk
Portfolio risk assessment.

**Permissions:** `Risk.Read`

### GET /api/v1/risk/assets/{id}
Asset risk detail.

### GET /api/v1/predictive/recommendations
Maintenance recommendations ranked by priority.

**Permissions:** `Predictive.Read`

**Response 200:**
```json
{
  "data": [
    {
      "recommendationId": "...",
      "assetCode": "SS-401-TX-01",
      "recommendationType": "Inspection",
      "recommendedAction": "Schedule DGA analysis within 14 days",
      "confidenceScore": 0.87,
      "riskProbability": 0.72,
      "priorityRank": 1,
      "rulMonths": 18,
      "estimatedCost": 15000,
      "modelVersion": "tx-failure-v2.1"
    }
  ]
}
```

### GET /api/v1/predictive/assets/{id}/forecast
Degradation forecast curve.

---

## 10. GIS APIs

### GET /api/v1/gis/layers
Available map layers.

### GET /api/v1/gis/features
**Query:** `layer`, `bbox`, `zoom`

### GET /api/v1/gis/assets/{id}/geometry
### POST /api/v1/gis/analytics/proximity
**Request:** `{ "centerLat": 19.07, "centerLon": 72.87, "radiusKm": 5, "assetTypes": ["Tower"] }`

---

## 11. Report APIs

### POST /api/v1/reports/generate
**Permissions:** `Reports.Generate`

**Request:**
```json
{
  "reportType": "AssetHealth",
  "format": "PDF",
  "parameters": { "region": "Western", "from": "2026-01-01", "to": "2026-06-30" }
}
```

**Response 202:**
```json
{ "data": { "reportJobId": "...", "status": "Processing" } }
```

### GET /api/v1/reports/{jobId}/download
Download generated report.

**Report Types:** AssetHealth, Outages, PreventiveMaintenance, PredictiveMaintenance, RegulatoryCompliance, RiskAssessment, PerformanceKPIs

**Formats:** PDF, Excel, CSV

---

## 12. Administration APIs

### GET /api/v1/admin/users
### POST /api/v1/admin/users/{id}/roles
### GET /api/v1/admin/roles
### GET /api/v1/admin/audit-logs
### GET /api/v1/admin/alarm-rules
### POST /api/v1/admin/alarm-rules

---

## 13. SignalR Hubs

### /hubs/monitoring
Real-time sensor value updates.

```javascript
connection.on("SensorReadingUpdated", (data) => { /* update dashboard */ });
connection.invoke("SubscribeAsset", assetId);
```

### /hubs/alarms
Real-time alarm notifications.

```javascript
connection.on("AlarmGenerated", (alarm) => { /* show notification */ });
connection.on("AlarmAcknowledged", (alarm) => { /* update list */ });
```

---

## 14. Rate Limiting

| Tier | Limit |
|------|-------|
| Standard | 1,000 requests/minute |
| Monitoring (live) | 5,000 requests/minute |
| Report generation | 10 requests/minute |
| Bulk import | 5 requests/minute |

---

## 15. OpenAPI

Full OpenAPI 3.0 specification available at:
- Swagger UI: `https://api.tams.{domain}/swagger`
- JSON: `https://api.tams.{domain}/swagger/v1/swagger.json`
- APIM Developer Portal: `https://developer.tams.{domain}`

---

**Maintained By:** API Platform Team

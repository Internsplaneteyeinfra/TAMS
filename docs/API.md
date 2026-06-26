# TAMS API Documentation

## Overview

The TAMS API provides RESTful access to transmission asset data, imagery, alerts, and analytics. All endpoints return standardized responses with metadata.

## Base URL

```
https://api.tams.example.com/api/v1
```

## Authentication

All requests require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Response Format

### Success Response

```json
{
  "data": {
    "id": "asset-123",
    "name": "Tower A",
    "asset_type": "tower",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "status": "active",
    "health_score": "healthy"
  },
  "meta": {
    "timestamp": "2024-06-10T12:00:00Z",
    "version": "1.0",
    "request_id": "req-123"
  }
}
```

### Paginated Response

```json
{
  "data": [...],
  "meta": {
    "timestamp": "2024-06-10T12:00:00Z",
    "version": "1.0",
    "request_id": "req-123",
    "pagination": {
      "page": 1,
      "page_size": 100,
      "total": 5000,
      "total_pages": 50
    }
  }
}
```

### Error Response

```json
{
  "detail": "Asset not found",
  "status_code": 404,
  "timestamp": "2024-06-10T12:00:00Z",
  "request_id": "req-123"
}
```

## Endpoints

### Assets

#### List Assets
```
GET /assets
```

**Query Parameters:**
- `page` (int, default=1): Page number
- `page_size` (int, default=100): Items per page (max 1000)
- `asset_type` (string): Filter by asset_type (tower, line, substation)
- `status` (string): Filter by status (active, inactive, maintenance)
- `bbox` (string): Bounding box filter (minx,miny,maxx,maxy)

**Example:**
```bash
curl -H "Authorization: Bearer token" \
  "https://api.tams.example.com/api/v1/assets?page=1&asset_type=tower"
```

**Response:**
```json
{
  "data": [
    {
      "id": "tower-1",
      "name": "Tower A",
      "asset_type": "tower",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "status": "active",
      "health_score": "healthy",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-06-10T12:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "page_size": 100,
      "total": 1000,
      "total_pages": 10
    }
  }
}
```

#### Create Asset
```
POST /assets
```

**Request Body:**
```json
{
  "name": "New Tower",
  "asset_type": "tower",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "status": "active",
  "description": "Tower description",
  "metadata": {
    "voltage": 345,
    "year_built": 1990
  }
}
```

#### Get Asset
```
GET /assets/{id}
```

**Example:**
```bash
curl -H "Authorization: Bearer token" \
  "https://api.tams.example.com/api/v1/assets/tower-1"
```

#### Update Asset
```
PATCH /assets/{id}
```

**Request Body:**
```json
{
  "name": "Updated Tower Name",
  "status": "maintenance"
}
```

#### Delete Asset
```
DELETE /assets/{id}
```

### Imagery

#### List Imagery
```
GET /imagery
```

**Query Parameters:**
- `page` (int): Page number
- `asset_id` (string): Filter by asset
- `source` (string): Data source (sentinel-2, sentinel-1, etc.)
- `date_from` (string): ISO 8601 date
- `date_to` (string): ISO 8601 date

#### Upload Imagery
```
POST /imagery/upload
```

**Request:** Multipart form data with image file and metadata

#### Process Imagery
```
POST /imagery/{id}/process
```

**Request Body:**
```json
{
  "processing_type": "tower_detection",
  "models": ["yolov11"]
}
```

### Alerts

#### List Alerts
```
GET /alerts
```

**Query Parameters:**
- `severity` (string): critical, high, medium, low
- `status` (string): open, acknowledged, resolved
- `asset_id` (string): Filter by asset

#### Create Alert
```
POST /alerts
```

**Request Body:**
```json
{
  "asset_id": "tower-1",
  "alert_type": "thermal_anomaly",
  "severity": "high",
  "description": "Thermal anomaly detected",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

#### Update Alert Status
```
PATCH /alerts/{id}
```

**Request Body:**
```json
{
  "status": "acknowledged"
}
```

### Analytics

#### Asset Health Scores
```
GET /analytics/health
```

**Query Parameters:**
- `asset_type` (string): Filter by asset type
- `region` (string): Geographic region

**Response:**
```json
{
  "data": [
    {
      "asset_id": "tower-1",
      "asset_name": "Tower A",
      "health_score": 0.85,
      "health_status": "healthy",
      "factors": {
        "structural_integrity": 0.90,
        "thermal_condition": 0.80,
        "operational_performance": 0.85
      }
    }
  ]
}
```

#### Risk Analysis
```
GET /analytics/risks
```

**Query Parameters:**
- `risk_type` (string): thermal, vegetation, structural, etc.
- `severity_threshold` (float): 0.0-1.0

#### Failure Predictions
```
GET /analytics/predictions
```

**Query Parameters:**
- `horizon_days` (int): Prediction horizon (default 90)
- `asset_type` (string): Filter by asset type

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Rate Limiting

API requests are rate limited to:
- **1000 requests per minute** per IP address
- **10000 requests per hour** per API key

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1623340800
```

## Pagination

All list endpoints support pagination with `page` and `page_size` parameters.

```bash
# Get page 2 with 50 items per page
GET /assets?page=2&page_size=50
```

## Filtering

Use query parameters to filter results:

```bash
# Filter by multiple conditions
GET /assets?asset_type=tower&status=active&page=1
```

## Sorting

Add `sort` parameter to sort results:

```bash
GET /assets?sort=name&order=asc
```

## Examples

### Get all towers with thermal anomalies
```bash
curl -H "Authorization: Bearer token" \
  "https://api.tams.example.com/api/v1/alerts?alert_type=thermal_anomaly&severity=high"
```

### Create and process satellite imagery
```bash
# 1. Upload imagery
curl -X POST -H "Authorization: Bearer token" \
  -F "file=@image.tif" \
  "https://api.tams.example.com/api/v1/imagery/upload"

# 2. Process with tower detection model
curl -X POST -H "Authorization: Bearer token" \
  "https://api.tams.example.com/api/v1/imagery/image-123/process" \
  -d '{"processing_type": "tower_detection"}'
```

### Get asset health dashboard
```bash
curl -H "Authorization: Bearer token" \
  "https://api.tams.example.com/api/v1/analytics/health?asset_type=tower"
```

---

**API Version**: 1.0
**Last Updated**: 2024-06-10

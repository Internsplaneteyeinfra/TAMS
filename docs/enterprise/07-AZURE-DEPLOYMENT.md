# Azure Deployment Architecture
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-AZURE-001  
**Version:** 1.0  
**Date:** July 2026

---

## 1. Azure Landing Zone Overview

TAMS deploys into an Azure Landing Zone aligned with the Cloud Adoption Framework (CAF):

```
Management Group: Utility-Production
├── Platform Subscription (Shared Services)
│   ├── Entra ID / Azure AD
│   ├── Azure Front Door + WAF
│   ├── Azure Monitor / Log Analytics
│   ├── Azure Key Vault (Platform)
│   └── Azure DevOps / GitHub Actions
│
├── TAMS-Production Subscription
│   ├── Resource Group: tams-prod-network
│   ├── Resource Group: tams-prod-compute
│   ├── Resource Group: tams-prod-data
│   ├── Resource Group: tams-prod-iot
│   └── Resource Group: tams-prod-ml
│
├── TAMS-NonProduction Subscription
│   ├── Dev / QA / Staging environments
│   └── Reduced SKUs, shared resources
│
└── TAMS-DR Subscription (Paired Region)
    └── Passive standby for SQL, ADX, Blob
```

---

## 2. Resource Topology

### 2.1 Production Resource Map

| Resource Group | Resources |
|----------------|-----------|
| **tams-prod-network** | VNet (10.1.0.0/16), NSGs, Azure Firewall, Private DNS Zones, Private Endpoints |
| **tams-prod-compute** | Container Apps Environment, API Management, Static Web Apps, SignalR Service |
| **tams-prod-data** | Azure SQL (Business Critical), ADX Cluster, Redis Premium, Blob Storage (GRS) |
| **tams-prod-iot** | IoT Hub (S2), Event Hub (20 TU), Stream Analytics, IoT Edge (DMZ) |
| **tams-prod-ml** | Azure ML Workspace, Azure OpenAI, Cognitive Services, Data Lake Gen2 |
| **tams-prod-integration** | Service Bus (Premium), Azure Functions (Consumption + Premium), Logic Apps |
| **tams-prod-security** | Key Vault, Defender for Cloud, Sentinel |

---

## 3. Network Architecture

```
                        INTERNET
                           │
                    Azure Front Door
                    (WAF + CDN + SSL)
                           │
              ┌────────────┼────────────┐
              │                         │
              ▼                         ▼
    Static Web Apps              API Management
    (Frontend CDN)               (Premium, VNet)
              │                         │
              │                         ▼
              │              Container Apps Subnet
              │              (10.1.1.0/24)
              │                         │
              │         ┌───────────────┼───────────────┐
              │         │               │               │
              │         ▼               ▼               ▼
              │      Asset Svc     Alarm Svc      Monitoring Svc
              │         │               │               │
              │         └───────────────┼───────────────┘
              │                         │
              │              Data Subnet (10.1.2.0/24)
              │                         │
              │         ┌───────────────┼───────────────┐
              │         ▼               ▼               ▼
              │      SQL (PE)       ADX (PE)        Redis (PE)
              │         │               │               │
              │         └───────────────┼───────────────┘
              │                         │
              │                    Blob (PE)
              │
    OT DMZ VNet (10.2.0.0/16) ── Peering ── TAMS VNet
              │
              ▼
         IoT Edge Gateway
              ▲
              │
    OT Network (10.3.0.0/16)
    SCADA / RTU / PMU / Sensors
```

### 3.1 NSG Rules (Summary)

| Source | Destination | Port | Action |
|--------|-------------|------|--------|
| Front Door | APIM | 443 | Allow |
| APIM Subnet | Container Apps | 443 | Allow |
| Container Apps | Data Subnet (PE) | 1433, 443, 6380 | Allow |
| IoT Edge (DMZ) | IoT Hub (PE) | 5671, 8883 | Allow |
| Any | Any | * | Deny (default) |

---

## 4. Service Configuration

### 4.1 Azure SQL Database

```yaml
Resource: tams-prod-sql
Tier: Business Critical
Compute: 8 vCores (Gen5)
Storage: 512 GB (auto-grow)
Backup: Geo-redundant, 35-day PITR
HA: Zone redundant
Read Replicas: 2 (reporting, analytics)
Encryption: TDE with CMK (Key Vault)
Auditing: Enabled → Log Analytics
Defender: SQL Vulnerability Assessment enabled
```

### 4.2 Azure Data Explorer

```yaml
Resource: tams-prod-adx
SKU: Standard_E4d_v4 × 3 nodes
Database: TamsTelemetry
Tables: SensorReadings, HealthScoreHistory, AlarmEvents
Retention: Hot 90d, Warm 730d, Cold 2555d
Ingestion: Event Hub → ADX data connection
Query caching: 30-day hot cache
Follower cluster: DR region (read-only)
```

### 4.3 Azure IoT Hub

```yaml
Resource: tams-prod-iothub
Tier: S2
Units: 12
Devices: 100,000 registered
Message routing:
  - telemetry → Event Hub (all messages)
  - twinChanges → Service Bus (device config)
  - errors → Log Analytics
Built-in endpoint: Disabled (all routed)
Fallback route: Event Hub
```

### 4.4 Azure Event Hub

```yaml
Resource: tams-prod-eventhub
Namespace: tams-prod-ehns
Throughput Units: 20
Partitions: 16 (sensor-telemetry)
Consumer Groups: adx-ingestion, stream-analytics, functions-processor
Capture: Enabled → Data Lake (Avro, 15-min window)
```

### 4.5 Azure Container Apps

```yaml
Environment: tams-prod-cae
VNet Integration: 10.1.1.0/24
Workload Profiles: Dedicated-D4 (4 vCPU, 16 GB)

Services (each):
  Min replicas: 2
  Max replicas: 10
  Scale rule: CPU > 70% or HTTP concurrent > 100
  Ingress: Internal only (via APIM)
  Identity: System-assigned managed identity
  Secrets: Key Vault references
```

### 4.6 Azure API Management

```yaml
Resource: tams-prod-apim
Tier: Premium (VNet integrated)
Policies:
  - validate-jwt (Entra ID)
  - rate-limit (1000/min standard)
  - cors (frontend origins)
  - set-header (correlation-id)
  - cache-lookup (GET dashboard, 60s)
Backends: Container Apps internal FQDNs
Developer Portal: Enabled for integration partners
```

---

## 5. CI/CD Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   GitHub    │───▶│   GitHub    │───▶│   Azure     │───▶│  Container  │
│   Push/PR   │    │   Actions   │    │  ACR Build  │    │  Apps Deploy│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ├── Unit Tests (.NET xUnit)
                          ├── Integration Tests (Testcontainers)
                          ├── SAST (CodeQL)
                          ├── Container Scan (Trivy)
                          ├── IaC Validate (Terraform plan)
                          └── Deploy to Staging → Manual Approval → Production
```

### 5.1 Environment Promotion

| Environment | Subscription | Approval | Data |
|-------------|-------------|----------|------|
| Dev | NonProd | Auto on merge to `develop` | Synthetic |
| QA | NonProd | Auto on merge to `release/*` | Anonymized prod subset |
| Staging | NonProd | Manual | Prod mirror (weekly refresh) |
| Production | Prod | Manual + Change Advisory Board | Live |

### 5.2 Infrastructure as Code

```bash
infrastructure/
├── terraform/
│   ├── modules/
│   │   ├── networking/
│   │   ├── compute/
│   │   ├── data/
│   │   ├── iot/
│   │   └── monitoring/
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   └── backend.tf          # Azure Storage remote state
└── bicep/                   # Alternative for Azure-native teams
```

---

## 6. Monitoring & Observability

### 6.1 Azure Monitor Setup

| Signal | Source | Destination |
|--------|--------|-------------|
| Metrics | All Azure resources | Azure Monitor Metrics |
| Logs | Container Apps, Functions, APIM | Log Analytics Workspace |
| Traces | Application Insights (all .NET services) | App Insights |
| Alerts | Metric + Log alerts | Action Groups → Teams, SMS, PagerDuty |
| Dashboards | Azure Dashboards + Grafana | NOC display, executive view |
| Security | Microsoft Sentinel | SIEM, threat detection |

### 6.2 Key Alerts

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| API Error Rate | 5xx > 1% for 5 min | Critical | PagerDuty + Teams |
| SQL DTU | > 80% for 10 min | Warning | Email DBA |
| IoT Hub Throttling | Throttled requests > 0 | Critical | PagerDuty |
| ADX Ingestion Lag | > 5 min delay | Warning | Email platform team |
| Container App Restarts | > 3 in 10 min | Warning | Teams |
| Failed Login Spike | > 50/min | Critical | Sentinel incident |

---

## 7. Cost Estimate (Production, Monthly)

| Service | SKU | Est. Cost (USD) |
|---------|-----|-----------------|
| Azure SQL Business Critical (8 vCore) | BC_Gen5_8 | $2,800 |
| ADX Cluster (3 × E4d_v4) | Standard | $3,500 |
| Container Apps (10 services × 2 replicas) | Dedicated-D4 | $2,400 |
| IoT Hub S2 (12 units) | S2 | $1,200 |
| Event Hub (20 TU) | Standard | $800 |
| API Management Premium | Premium | $2,500 |
| Redis Premium P2 | P2 | $600 |
| Blob Storage (5 TB GRS) | Hot/Cool | $200 |
| Front Door Premium | Premium | $400 |
| Application Insights | Pay-as-you-go | $300 |
| Azure ML + OpenAI | Usage-based | $500 |
| Other (Functions, Service Bus, Key Vault) | — | $400 |
| **Total Estimated** | | **~$15,600/month** |

*Note: Costs vary by region, commitment discounts (RI/Savings Plan), and actual usage.*

---

## 8. DR & Backup Procedures

| Component | Backup Method | Frequency | Retention |
|-----------|--------------|-----------|-----------|
| Azure SQL | Automated backup + LTR | Continuous | 35d PITR, 7y LTR |
| ADX | Follower cluster + export to Blob | Daily export | 7 years |
| Blob Storage | GRS (auto geo-replicate) | Continuous | Lifecycle policy |
| Key Vault | Soft delete + purge protection | Continuous | 90 days |
| Terraform State | Azure Storage (GRS) | Every apply | Versioned |
| Container Images | ACR (geo-replicated) | Every build | Last 30 versions |

**Failover Procedure:**
1. Confirm region outage via Azure Status + internal monitoring
2. Activate DR runbook (Azure Site Recovery / manual)
3. Failover SQL geo-replica (automatic or manual)
4. Promote ADX follower cluster
5. Update Front Door backend pool to DR region
6. Update DNS/Front Door routing
7. Validate ingestion pipeline from IoT Edge (may require gateway re-point)
8. Communicate to stakeholders

**Target RPO:** 15 minutes | **Target RTO:** 4 hours

---

**Maintained By:** Cloud Infrastructure Team

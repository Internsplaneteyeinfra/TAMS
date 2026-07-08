# Security Design Document
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-SEC-001  
**Version:** 1.0  
**Date:** July 2026  
**Compliance:** ISO 27001, NIST CSF, IEC 62443

---

## 1. Security Objectives

| Objective | Description |
|-----------|-------------|
| Confidentiality | Protect asset data, SCADA telemetry, and user credentials |
| Integrity | Ensure alarm, maintenance, and audit data cannot be tampered |
| Availability | Maintain 99.9% uptime; resist DoS and ransomware |
| Accountability | Full audit trail for all privileged actions |
| OT/IT Segregation | Prevent direct OT network exposure to cloud |

---

## 2. Zero Trust Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZERO TRUST PRINCIPLES                         │
│                                                                  │
│  1. Verify Explicitly    → Azure AD + MFA + Conditional Access  │
│  2. Least Privilege      → RBAC per module/action               │
│  3. Assume Breach        → Micro-segmentation, encryption, audit│
│  4. Continuous Validation→ Session risk scoring, device compliance│
└─────────────────────────────────────────────────────────────────┘

Identity Layer          Network Layer           Data Layer
─────────────          ─────────────           ──────────
Entra ID (SSO)         Private Endpoints       TDE (SQL)
MFA (Mandatory)        NSG + Azure Firewall    CMK (Key Vault)
Conditional Access     VNet Isolation          Blob Encryption
PIM (JIT Admin)        APIM WAF                ADX Encryption
Managed Identities     No Public DB Endpoints    TLS 1.3 in transit
```

---

## 3. Identity & Access Management

### 3.1 Azure AD (Entra ID) Configuration

| Setting | Value |
|---------|-------|
| Authentication | OAuth 2.0 / OpenID Connect |
| MFA | Required for all users (Authenticator app) |
| Conditional Access | Compliant device + trusted location for admin |
| Session Lifetime | 8 hours (operations), 1 hour (admin) |
| Guest Access | Disabled (B2B for vendors only, time-limited) |
| Password Policy | N/A (SSO only, no local passwords) |

### 3.2 Role-Based Access Control (RBAC)

See Section 8 (Role Matrix) in this document.

**Implementation:**
- Entra ID App Roles mapped to TAMS Roles table
- API: `[Authorize(Roles = "OperationsEngineer")]` + custom policy handlers
- Frontend: Route guards + component-level permission checks
- Database: Row-level security (optional) for regional data isolation

### 3.3 Privileged Access

| Control | Implementation |
|---------|---------------|
| JIT Admin Access | Azure PIM – max 4-hour elevation |
| Break-glass Account | 2 sealed envelopes, monitored, MFA exempt (logged) |
| Service Accounts | Managed Identities (no stored credentials) |
| API Keys | APIM subscription keys for integration partners only |
| Vendor Access | Time-bound B2B guest, scoped to assigned work orders |

---

## 4. Role Permission Matrix

| Module / Action | Admin | Ops Engineer | Maint Engineer | Asset Engineer | Sub Operator | Field Tech | Executive | Auditor | Vendor |
|-----------------|-------|-------------|----------------|----------------|-------------|------------|-----------|---------|--------|
| **Assets** | | | | | | | | | |
| View | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Assigned |
| Create/Edit | ✓ | — | — | ✓ | — | — | — | — | — |
| Delete/Deactivate | ✓ | — | — | ✓ | — | — | — | — | — |
| **Monitoring** | | | | | | | | | |
| View Live | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Configure Sensors | ✓ | — | — | ✓ | — | — | — | — | — |
| **Alarms** | | | | | | | | | |
| View | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Acknowledge | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| Close | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Configure Rules | ✓ | — | — | — | — | — | — | — | — |
| **Health/Risk** | | | | | | | | | |
| View | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Configure Models | ✓ | — | — | ✓ | — | — | — | — | — |
| **Maintenance** | | | | | | | | | |
| View WOs | ✓ | ✓ | ✓ | ✓ | ✓ | Assigned | ✓ | ✓ | Assigned |
| Create/Edit WOs | ✓ | — | ✓ | — | — | — | — | — | — |
| Execute WOs | ✓ | — | ✓ | — | — | ✓ | — | — | ✓ |
| **Inspections** | | | | | | | | | |
| View | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Create/Submit | ✓ | — | ✓ | ✓ | — | ✓ | — | — | — |
| AI Analysis | ✓ | — | — | ✓ | — | — | — | — | — |
| **GIS** | | | | | | | | | |
| View | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Edit Layers | ✓ | — | — | ✓ | — | — | — | — | — |
| **Analytics/Dashboard** | | | | | | | | | |
| Operations | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| Maintenance | ✓ | — | ✓ | — | — | — | — | — | — |
| Executive | ✓ | — | — | — | — | — | ✓ | ✓ | — |
| **Reports** | | | | | | | | | |
| Generate | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | — |
| Export | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | — |
| **Administration** | | | | | | | | | |
| User Management | ✓ | — | — | — | — | — | — | — | — |
| Role Management | ✓ | — | — | — | — | — | — | — | — |
| Audit Logs | ✓ | — | — | — | — | — | — | ✓ | — |
| System Config | ✓ | — | — | — | — | — | — | — | — |
| Alarm Rules | ✓ | ✓ | — | — | — | — | — | — | — |
| Notification Config | ✓ | — | — | — | — | — | — | — | — |

---

## 5. Data Encryption

### 5.1 At Rest

| Data Store | Encryption | Key Management |
|------------|------------|----------------|
| Azure SQL | TDE (AES-256) | Customer-Managed Key (CMK) in Key Vault |
| ADX | Service-managed + CMK option | Key Vault |
| Blob Storage | SSE (AES-256) | CMK in Key Vault |
| Redis | Encryption at rest (Premium) | Microsoft-managed |
| Backups | Encrypted (inherits source) | CMK |

### 5.2 In Transit

| Path | Protocol |
|------|----------|
| Client → Front Door | TLS 1.3 |
| Front Door → APIM | TLS 1.3 |
| APIM → Container Apps | TLS 1.3 (internal) |
| Services → SQL/ADX/Redis | TLS 1.2+ (Private Endpoint) |
| IoT Edge → IoT Hub | TLS 1.2 (X.509 cert auth) |
| Mobile App → API | TLS 1.3 + cert pinning |

### 5.3 Application-Level

- PII fields (email, phone): masked in logs
- Inspection images: SAS tokens with 1-hour expiry
- Audit log `OldValues`/`NewValues`: encrypted for sensitive fields
- Report downloads: signed URLs, 15-minute expiry

---

## 6. API Security

| Control | Implementation |
|---------|---------------|
| Authentication | JWT Bearer (Entra ID), validated at APIM + service |
| Authorization | RBAC claims in token + server-side policy |
| Input Validation | FluentValidation; reject unexpected fields |
| Rate Limiting | APIM: 1000 req/min standard; 429 response |
| CORS | Whitelist frontend origins only |
| WAF | Front Door managed rules + custom OT-specific rules |
| API Versioning | Deprecation headers; 12-month notice |
| Request Signing | HMAC for integration partner webhooks |
| OWASP Top 10 | Addressed via secure coding standards + SAST/DAST |

---

## 7. Network Security

```
Internet ──▶ Front Door (WAF) ──▶ APIM (VNet) ──▶ Container Apps (VNet)
                                                      │
                                              Private Endpoints ONLY
                                                      │
                                              SQL / ADX / Redis / Blob

OT Network ──▶ IoT Edge (DMZ) ──▶ IoT Hub (PE) ──▶ Event Hub ──▶ Processing
                ▲
                │ (One-way: OT → Cloud only for telemetry)
                │ (Commands: Cloud → IoT Edge → OT via approved channel)
         SCADA/RTU/Sensors
```

| Control | Detail |
|---------|--------|
| No public DB endpoints | Private Endpoints only |
| NSG default deny | Explicit allow rules only |
| Azure Firewall | Outbound FQDN filtering for Container Apps |
| DDoS Protection | Front Door Premium DDoS |
| OT/IT Gateway | IoT Edge in DMZ; no direct SCADA-to-cloud |
| Network Watcher | Flow logs enabled; anomaly detection |

---

## 8. Audit Logging

### 8.1 Events Logged

| Category | Events |
|----------|--------|
| Authentication | Login, logout, MFA challenge, failed login, token refresh |
| Authorization | Access denied, role change, privilege elevation |
| Asset | Create, update, deactivate, bulk import |
| Alarm | Generate, acknowledge, close, suppress, escalate |
| Maintenance | WO create, assign, complete, cancel |
| Inspection | Create, submit, AI analysis trigger |
| Admin | User create/deactivate, role assign, config change |
| Report | Generate, download, export |
| Integration | EAM sync, SCADA ingest errors |

### 8.2 Audit Log Properties

```json
{
  "auditLogId": "guid",
  "timestamp": "2026-07-06T10:00:00Z",
  "userId": "guid",
  "userEmail": "rajesh@utility.com",
  "action": "Alarm.Acknowledge",
  "entityType": "Alarm",
  "entityId": "guid",
  "oldValues": { "status": "Active" },
  "newValues": { "status": "Acknowledged" },
  "ipAddress": "10.1.0.50",
  "userAgent": "Mozilla/5.0...",
  "correlationId": "guid"
}
```

### 8.3 Retention & Integrity
- Retention: 10 years (immutable storage after 90 days)
- Integrity: Append-only table; no UPDATE/DELETE permissions for app accounts
- SIEM: Forwarded to Microsoft Sentinel for correlation

---

## 9. Compliance Mapping

### 9.1 ISO 27001 Controls

| Control | TAMS Implementation |
|---------|---------------------|
| A.9 Access Control | Entra ID, RBAC, MFA, PIM |
| A.10 Cryptography | TDE, CMK, TLS 1.3 |
| A.12 Operations Security | Azure Monitor, Sentinel, patch management |
| A.13 Communications Security | Private Endpoints, WAF, encryption |
| A.14 System Development | Secure SDLC, SAST/DAST, code review |
| A.16 Incident Management | Sentinel playbooks, incident response runbook |
| A.17 Business Continuity | DR plan, geo-replication, backup testing |
| A.18 Compliance | Audit logs, compliance reports, annual pen test |

### 9.2 NIST Cybersecurity Framework

| Function | TAMS Coverage |
|----------|---------------|
| Identify | Asset inventory, risk assessment, data classification |
| Protect | IAM, encryption, WAF, NSG, secure development |
| Detect | Sentinel SIEM, anomaly detection, audit monitoring |
| Respond | Incident response plan, automated playbooks |
| Recover | DR failover, backup restore, business continuity |

### 9.3 IEC 62443 (Industrial Security)

| Requirement | Implementation |
|-------------|----------------|
| Zone & Conduit Model | OT / DMZ / IT zones with controlled conduits |
| SL-T Target | SL-T2 for monitoring (read-only SCADA data) |
| Component Security | IoT Edge hardened; signed firmware updates |
| System Security | Defense in depth; no direct OT-to-internet |
| Patch Management | Controlled patching windows for IoT Edge |

---

## 10. Security Testing

| Test | Frequency | Owner |
|------|-----------|-------|
| SAST (CodeQL) | Every PR | DevOps (automated) |
| DAST (OWASP ZAP) | Weekly (staging) | Security Team |
| Penetration Test | Annual | Third-party |
| Vulnerability Scan | Monthly | Azure Defender |
| OT Security Assessment | Annual | OT Security Team |
| DR/Backup Restore Test | Semi-annual | Infrastructure |
| Access Review | Quarterly | IAM Team |
| Red Team Exercise | Biennial | External |

---

## 11. Incident Response

```
Detect (Sentinel/Monitor) → Triage (SOC) → Contain → Eradicate → Recover → Lessons Learned
                                │
                                ├── Severity 1 (Critical): 15-min response, VP notification
                                ├── Severity 2 (High): 1-hour response
                                └── Severity 3 (Medium/Low): 4-hour response
```

**OT-Specific Incidents:**
- Unauthorized SCADA command attempt → isolate IoT Edge, alert OT team
- Sensor data manipulation → quarantine affected data, forensic analysis
- Ransomware indicator → activate DR, isolate affected VNets

---

**Maintained By:** Information Security Team  
**Classification:** Internal – Confidential

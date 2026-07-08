# Business Requirements Document (BRD)
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-BRD-001  
**Version:** 1.0  
**Date:** July 2026  
**Status:** Approved for Implementation Planning

---

## 1. Executive Summary

TAMS (Transmission Asset Monitoring System) is a centralized digital platform that monitors, manages, analyzes, and predicts the health and performance of transmission assets throughout their lifecycle. The platform integrates SCADA, IoT sensors, RTUs, GIS, inspection records, maintenance history, and enterprise asset management (EAM) systems to enable real-time operations, predictive maintenance, and executive decision-making for electric power transmission utilities.

---

## 2. Business Objectives

| ID | Objective | Success Measure |
|----|-----------|-----------------|
| BO-01 | Reduce unplanned transmission outages | 25% reduction in outage frequency within 3 years |
| BO-02 | Improve asset availability | ≥ 99.5% critical asset availability |
| BO-03 | Optimize O&M expenditure | 15–20% reduction in reactive maintenance costs |
| BO-04 | Enable predictive maintenance | 40% of maintenance work orders driven by predictive analytics |
| BO-05 | Centralize asset intelligence | Single source of truth for 100% of in-scope assets |
| BO-06 | Improve regulatory compliance | 100% audit-ready maintenance and inspection records |
| BO-07 | Reduce SAIDI/SAIFI | Measurable improvement in reliability indices |
| BO-08 | Accelerate fault response | Mean time to acknowledge critical alarms < 5 minutes |
| BO-09 | Support capital planning | Data-driven RUL and risk scores for 5,000+ transformers |
| BO-10 | Enable executive visibility | Real-time KPI dashboards for C-suite and board reporting |

---

## 3. Current Challenges

### 3.1 Operational Challenges

- **Siloed systems:** SCADA, GIS, EAM, and inspection data exist in disconnected platforms with no unified asset view.
- **Reactive maintenance:** Failures are often detected only after operational impact or during scheduled patrols.
- **Manual processes:** Paper-based inspections, spreadsheet tracking, and email-based alarm escalation.
- **Limited visibility:** No real-time health index across substations, lines, and transformers at portfolio level.
- **Delayed fault localization:** GIS and SCADA are not integrated for rapid fault triage.

### 3.2 Technical Challenges

- **Data volume:** Millions of sensor readings per day from RTUs, PMUs, DGA analyzers, and IoT devices.
- **Legacy integration:** Heterogeneous protocols (IEC 61850, DNP3, Modbus, OPC-UA) across substations.
- **Scalability:** Existing tools cannot scale to 500+ substations and 25,000+ circuit KM.
- **Security:** OT/IT convergence increases cyber-physical risk; NERC CIP and IEC 62443 compliance required.
- **AI readiness:** Historical failure data is unstructured and not ML-ready.

### 3.3 Business Impact

- Increased SAIDI/SAIFI and customer complaints
- Higher emergency maintenance and spare parts costs
- Regulatory penalties for incomplete records
- Extended outage restoration times
- Suboptimal capital replacement decisions

---

## 4. Proposed Solution

TAMS provides an enterprise-grade, cloud-native platform on Microsoft Azure comprising:

1. **Unified Asset Registry** – Hierarchical asset master with GIS coordinates, lifecycle, and criticality
2. **Real-Time Monitoring** – SCADA/IoT ingestion with live dashboards and trend analysis
3. **Condition Monitoring** – Composite health, condition, and risk scores with RUL estimation
4. **Alarm Management** – Severity-based alarm lifecycle with multi-channel notifications
5. **Predictive Maintenance** – AI-driven failure prediction and maintenance recommendations
6. **Maintenance Management** – Work orders, scheduling, spare parts, and history
7. **GIS Module** – ArcGIS/Google Maps/OSM integration with geospatial analytics
8. **Inspection Management** – Manual, drone, thermal, and visual inspections with AI image analysis
9. **Analytics Dashboards** – Role-based KPI views for operations, maintenance, engineering, and executives
10. **Mobile Application** – Field technician app with offline capability
11. **Reporting Engine** – PDF/Excel/CSV exports for regulatory and operational reporting

---

## 5. Benefits

| Category | Benefit |
|----------|---------|
| **Reliability** | Proactive fault detection; faster restoration; reduced cascading failures |
| **Financial** | Lower O&M costs; optimized spare parts inventory; better CAPEX planning |
| **Safety** | Early detection of transformer DGA anomalies, line sag, SF6 leaks |
| **Compliance** | Complete audit trail; ISO 27001 / NIST / IEC 62443 alignment |
| **Productivity** | Automated alarm routing; mobile work order execution; reduced manual data entry |
| **Decision Support** | Executive dashboards; risk heatmaps; predictive maintenance prioritization |
| **Integration** | Single platform connecting SCADA, GIS, EAM, and inspection systems |

---

## 6. Key Performance Indicators (KPIs)

### 6.1 Reliability KPIs

| KPI | Definition | Target |
|-----|------------|--------|
| SAIDI | System Average Interruption Duration Index | Reduce 20% YoY |
| SAIFI | System Average Interruption Frequency Index | Reduce 15% YoY |
| MTBF | Mean Time Between Failures (critical assets) | Increase 25% |
| MTTR | Mean Time To Repair | Reduce 30% |
| Asset Availability | Uptime of monitored critical assets | ≥ 99.5% |

### 6.2 Operational KPIs

| KPI | Target |
|-----|--------|
| Critical alarm acknowledgment time | < 5 minutes |
| Alarm false positive rate | < 10% |
| Predictive work order conversion rate | ≥ 40% of total PM+PdM |
| Inspection completion on schedule | ≥ 95% |
| GIS asset location accuracy | ≥ 99% |

### 6.3 Platform KPIs

| KPI | Target |
|-----|--------|
| System uptime | 99.9% |
| API response time (p95) | < 500 ms |
| Sensor ingestion latency | < 30 seconds |
| Dashboard load time | < 3 seconds |
| Concurrent users supported | 2,000+ |

---

## 7. User Personas

### Persona 1: Rajesh – Operations Engineer
- **Role:** 24/7 control room monitoring
- **Goals:** Real-time visibility, fast alarm triage, outage coordination
- **Pain Points:** Too many alarms, no unified view, manual SCADA/GIS switching
- **TAMS Value:** Unified dashboard, intelligent alarm prioritization, GIS fault overlay

### Persona 2: Priya – Maintenance Engineer
- **Role:** Plans and schedules maintenance across regions
- **Goals:** Optimize crew scheduling, track work orders, manage spare parts
- **Pain Points:** Reactive firefighting, incomplete asset history
- **TAMS Value:** Predictive maintenance queue, work order lifecycle, maintenance history

### Persona 3: Amit – Asset Engineer
- **Role:** Technical authority for transformers, lines, breakers
- **Goals:** Health assessment, RUL analysis, technical recommendations
- **Pain Points:** Disparate DGA, loading, and inspection data
- **TAMS Value:** Condition monitoring scores, trend analysis, risk assessment

### Persona 4: Sunita – Substation Operator
- **Role:** Local substation operations
- **Goals:** Monitor local assets, acknowledge alarms, log events
- **Pain Points:** Limited mobile access, paper logs
- **TAMS Value:** Substation-specific views, mobile notifications, digital logs

### Persona 5: Vikram – Field Technician
- **Role:** Executes inspections and corrective maintenance in the field
- **Goals:** Receive work orders, capture photos, update status offline
- **Pain Points:** No connectivity in remote areas, paper forms
- **TAMS Value:** Mobile app with offline sync, GPS tagging, QR asset lookup

### Persona 6: Dr. Mehta – Executive Management
- **Role:** VP Operations / CTO
- **Goals:** Portfolio risk view, budget justification, regulatory reporting
- **Pain Points:** Delayed reports, no predictive insight
- **TAMS Value:** Executive dashboard, KPI trends, risk heatmaps

### Persona 7: Ananya – Auditor
- **Role:** Internal/compliance audit
- **Goals:** Verify maintenance records, alarm audit trails, access logs
- **Pain Points:** Incomplete records across systems
- **TAMS Value:** Immutable audit logs, role-based reports, compliance exports

---

## 8. Stakeholders

| Stakeholder | Interest | Influence |
|-------------|----------|-----------|
| CEO / Board | ROI, reliability, regulatory standing | High |
| VP Transmission Operations | Real-time monitoring, outage management | High |
| VP Asset Management | Lifecycle, CAPEX planning | High |
| CIO / CISO | Architecture, security, integration | High |
| Control Center Manager | Alarm management, dashboards | High |
| Maintenance Manager | Work orders, scheduling | Medium |
| GIS Team | Spatial data, map integration | Medium |
| SCADA/OT Team | Protocol integration, OT security | High |
| Regulatory Affairs | Compliance reporting | Medium |
| Field Operations | Mobile usability | Medium |
| Vendors / Contractors | Limited asset/work order access | Low |
| Customers (indirect) | Service reliability | Low |

---

## 9. Use Cases

### UC-01: Real-Time Transformer Monitoring
**Actor:** Operations Engineer  
**Precondition:** Transformer instrumented with DGA, temperature, load sensors  
**Flow:** System ingests sensor data → displays live dashboard → generates alarm if DGA threshold exceeded → notifies on-call engineer via Teams/SMS  
**Postcondition:** Alarm acknowledged and work order created

### UC-02: Predictive Maintenance Recommendation
**Actor:** Asset Engineer  
**Precondition:** 12+ months historical data for transformer  
**Flow:** ML model scores degradation → recommends inspection within 30 days → maintenance engineer schedules work order  
**Postcondition:** Predictive work order in maintenance queue with confidence score

### UC-03: GIS Fault Localization
**Actor:** Operations Engineer  
**Precondition:** Fault alarm on transmission line  
**Flow:** Alarm triggers → GIS map zooms to fault corridor → tower/span highlighted → crew location displayed  
**Postcondition:** Dispatch team navigates to fault location

### UC-04: Drone Inspection with AI Analysis
**Actor:** Field Technician, Asset Engineer  
**Precondition:** Inspection scheduled for line corridor  
**Flow:** Technician uploads drone imagery → AI detects corrosion/vegetation encroachment → findings linked to asset → condition score updated  
**Postcondition:** Inspection report stored; defects flagged for maintenance

### UC-05: Executive Risk Dashboard
**Actor:** Executive Management  
**Precondition:** Health scores computed for all critical assets  
**Flow:** Executive logs in → views portfolio risk heatmap → drills into top 10 at-risk transformers  
**Postcondition:** Informed CAPEX decision

### UC-06: Alarm Escalation
**Actor:** System (automated), Operations Engineer, Maintenance Manager  
**Precondition:** Critical alarm unacknowledged for 5 minutes  
**Flow:** Escalation matrix triggers → SMS to backup engineer → Teams notification to manager  
**Postcondition:** Alarm acknowledged or escalated to emergency maintenance

### UC-07: Regulatory Compliance Report
**Actor:** Auditor  
**Precondition:** Maintenance and inspection records for reporting period  
**Flow:** Auditor generates PM compliance report → exports PDF → verifies audit trail  
**Postcondition:** Compliance report archived

---

## 10. Functional Requirements

### FR-01: Asset Registry
| ID | Requirement |
|----|-------------|
| FR-01.1 | System shall maintain asset master records with ID, category, type, manufacturer, serial number, installation date, warranty, voltage level, capacity, GIS coordinates, status, and criticality |
| FR-01.2 | System shall support parent-child asset hierarchy (substation → bay → equipment) |
| FR-01.3 | System shall support asset tagging and QR code generation/scanning |
| FR-01.4 | System shall track asset lifecycle states: Planned, Installed, In-Service, Under Maintenance, Decommissioned |
| FR-01.5 | System shall integrate with EAM for bidirectional asset sync |

### FR-02: Real-Time Monitoring
| ID | Requirement |
|----|-------------|
| FR-02.1 | System shall ingest SCADA/IoT data via Azure IoT Hub and Event Hub |
| FR-02.2 | System shall monitor transformer parameters: oil temp, winding temp, load, voltage, current, DGA, oil level |
| FR-02.3 | System shall monitor line parameters: current, voltage, sag, conductor temp, weather |
| FR-02.4 | System shall monitor breaker parameters: ops count, SF6 pressure, contact wear, trip status |
| FR-02.5 | System shall monitor relay status, event logs, and fault records |
| FR-02.6 | System shall monitor substation bus voltage, frequency, energy flow, demand |
| FR-02.7 | System shall display real-time dashboards, trends, historical analysis, and event timelines |

### FR-03: Condition Monitoring
| ID | Requirement |
|----|-------------|
| FR-03.1 | System shall compute composite health index from age, loading, inspection, failure history, sensor health, criticality |
| FR-03.2 | System shall provide health score (0–100), condition score, risk score, and RUL estimate |
| FR-03.3 | System shall recalculate scores on configurable schedule (default: daily) |

### FR-04: Alarm Management
| ID | Requirement |
|----|-------------|
| FR-04.1 | System shall generate alarms from threshold breaches, anomaly detection, and manual events |
| FR-04.2 | System shall support severity levels: Critical, High, Medium, Low |
| FR-04.3 | System shall support acknowledge, escalate, and close workflows |
| FR-04.4 | System shall notify via email, SMS, mobile push, Teams, WhatsApp |
| FR-04.5 | System shall maintain immutable alarm audit history |

### FR-05: Predictive Maintenance
| ID | Requirement |
|----|-------------|
| FR-05.1 | System shall predict asset failures with confidence score and risk probability |
| FR-05.2 | System shall rank maintenance recommendations by priority |
| FR-05.3 | System shall forecast asset degradation and RUL |
| FR-05.4 | System shall integrate predictions into work order creation |

### FR-06: Maintenance Management
| ID | Requirement |
|----|-------------|
| FR-06.1 | System shall support PM, PdM, corrective, and emergency maintenance types |
| FR-06.2 | System shall manage work orders: create, assign, schedule, execute, close |
| FR-06.3 | System shall track spare parts consumption and inventory |
| FR-06.4 | System shall maintain complete maintenance history per asset |

### FR-07: GIS Module
| ID | Requirement |
|----|-------------|
| FR-07.1 | System shall integrate ArcGIS, Google Maps, and OpenStreetMap |
| FR-07.2 | System shall display lines, towers, substations, faults, and crew locations |
| FR-07.3 | System shall provide geospatial analytics (proximity, corridor risk, heatmaps) |

### FR-08: Inspection Management
| ID | Requirement |
|----|-------------|
| FR-08.1 | System shall support manual, drone, thermal, and visual inspections |
| FR-08.2 | System shall store images, videos, reports, and observations |
| FR-08.3 | System shall perform AI image analysis for defect detection |

### FR-09: Analytics & Reporting
| ID | Requirement |
|----|-------------|
| FR-09.1 | System shall provide role-based dashboards for operations, maintenance, engineering, management, executives |
| FR-09.2 | System shall compute and display SAIDI, SAIFI, MTBF, MTTR, availability, cost, risk KPIs |
| FR-09.3 | System shall export reports in PDF, Excel, CSV |

### FR-10: Administration
| ID | Requirement |
|----|-------------|
| FR-10.1 | System shall support user/role management with Azure AD integration |
| FR-10.2 | System shall support configurable alarm rules, escalation matrices, and notification templates |
| FR-10.3 | System shall provide audit log search and export |

---

## 11. Non-Functional Requirements

### NFR-01: Performance
- Ingest ≥ 5 million sensor records/day with < 30s end-to-end latency
- API p95 response < 500 ms for read operations
- Dashboard initial load < 3 seconds
- Support 2,000 concurrent users

### NFR-02: Availability
- 99.9% uptime (excluding planned maintenance)
- RPO ≤ 15 minutes; RTO ≤ 4 hours
- Multi-region active-passive deployment

### NFR-03: Scalability
- Horizontal scaling for API and ingestion tiers
- ADX partitioning for time-series retention (hot: 90 days, warm: 2 years, cold: 7+ years)

### NFR-04: Security
- Azure AD with MFA mandatory for all users
- RBAC with least privilege
- Encryption at rest (AES-256) and in transit (TLS 1.3)
- Zero Trust network architecture
- Compliance: ISO 27001, NIST CSF, IEC 62443

### NFR-05: Usability
- WCAG 2.1 AA accessibility
- Responsive design for desktop, tablet, mobile
- Support English (primary); extensible i18n

### NFR-06: Interoperability
- REST APIs with OpenAPI 3.0 specification
- Support IEC 61850, DNP3, Modbus, OPC-UA ingestion adapters
- EAM/GIS/SCADA integration via standard APIs and message bus

### NFR-07: Maintainability
- Microservices with independent deployment
- 80%+ unit test coverage for business logic
- Structured logging with correlation IDs

### NFR-08: Data Retention
- Sensor data: configurable per asset type (default 7 years)
- Audit logs: 10 years immutable
- Inspection media: lifecycle of asset + 3 years

---

## 12. Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC-01 | 100% of in-scope assets registered with hierarchy and GIS coordinates | Data migration audit |
| AC-02 | Real-time dashboards display sensor data within 30 seconds of ingestion | Performance test |
| AC-03 | Health scores computed for all critical assets daily | Automated job verification |
| AC-04 | Alarm lifecycle (generate → acknowledge → close) with full audit trail | UAT scenario |
| AC-05 | Predictive model achieves ≥ 75% precision on pilot transformer dataset | ML validation report |
| AC-06 | Work order created from alarm in < 3 clicks | UAT |
| AC-07 | GIS displays fault location within 100m accuracy | Field validation |
| AC-08 | Mobile app functions offline and syncs on reconnect | Field test |
| AC-09 | Executive dashboard loads all KPIs in < 3 seconds | Load test |
| AC-10 | Security penetration test passes with no critical findings | Third-party audit |
| AC-11 | Azure AD SSO with MFA for all users | Identity test |
| AC-12 | Regulatory compliance report generated and exported to PDF | UAT |

---

## 13. Assumptions and Constraints

### Assumptions
- Utility provides SCADA/IoT connectivity to Azure via secure gateway
- Historical asset and maintenance data available for migration
- Azure subscription and Entra ID tenant provisioned
- GIS base layers licensed (ArcGIS Enterprise or equivalent)

### Constraints
- OT network segregation requires DMZ-based ingestion
- NERC CIP compliance for bulk electric system assets (US utilities)
- Budget phased over 24-month implementation
- Legacy EAM integration limited to REST/SOAP APIs

---

## 14. Glossary

| Term | Definition |
|------|------------|
| DGA | Dissolved Gas Analysis (transformer oil diagnostic) |
| RUL | Remaining Useful Life |
| SAIDI | System Average Interruption Duration Index |
| SAIFI | System Average Interruption Frequency Index |
| PMU | Phasor Measurement Unit |
| RTU | Remote Terminal Unit |
| EAM | Enterprise Asset Management |
| ADX | Azure Data Explorer |

---

**Approval**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Sponsor | | | |
| Product Owner | | | |
| Enterprise Architect | | | |

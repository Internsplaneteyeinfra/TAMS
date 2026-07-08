# TAMS Enterprise Documentation Suite

**Transmission Asset Monitoring System (TAMS)**  
Version 1.0 | Document Set | July 2026

---

## Document Index

| # | Document | File | Audience |
|---|----------|------|----------|
| 1 | Business Requirements Document (BRD) | [01-BRD.md](./01-BRD.md) | Business, Product, Stakeholders |
| 2 | Software Requirements Specification (SRS) | [02-SRS.md](./02-SRS.md) | Product, Engineering, QA |
| 3 | Enterprise Architecture Document | [03-ENTERPRISE-ARCHITECTURE.md](./03-ENTERPRISE-ARCHITECTURE.md) | Architects, Tech Leads |
| 4 | Database Design & ER Model | [04-DATABASE-DESIGN.md](./04-DATABASE-DESIGN.md) | DBAs, Backend Engineers |
| 5 | API Specification | [05-API-SPECIFICATION.md](./05-API-SPECIFICATION.md) | Frontend, Integration, QA |
| 6 | UI/UX Design Guide | [06-UI-UX-DESIGN-GUIDE.md](./06-UI-UX-DESIGN-GUIDE.md) | UX, Frontend, Product |
| 7 | Azure Deployment Architecture | [07-AZURE-DEPLOYMENT.md](./07-AZURE-DEPLOYMENT.md) | Cloud, DevOps, Security |
| 8 | Security Design Document | [08-SECURITY-DESIGN.md](./08-SECURITY-DESIGN.md) | Security, Compliance, Architects |
| 9 | Implementation Plan & Roadmap | [09-IMPLEMENTATION-PLAN.md](./09-IMPLEMENTATION-PLAN.md) | PMO, Leadership, Delivery |
| 10 | Product Backlog | [10-PRODUCT-BACKLOG.md](./10-PRODUCT-BACKLOG.md) | Scrum Teams, Product Owner |
| 11 | MVP & Production Release Strategy | [11-MVP-RELEASE-STRATEGY.md](./11-MVP-RELEASE-STRATEGY.md) | Leadership, Product, Delivery |
| 12 | **Implementation Guide (code)** | [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Developers |

---

## Platform Scope Summary

TAMS is a centralized digital platform for electric power transmission utilities operating at enterprise scale:

| Asset Class | Scale Target |
|-------------|--------------|
| Substations | 500+ |
| Transmission Towers | 10,000+ |
| Circuit KM (Lines) | 25,000+ |
| Power Transformers | 5,000+ |
| Breakers, Relays, CT/PTs, Capacitors, Reactors | Thousands |
| Sensor Records | Millions per day |

---

## Target Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Material UI |
| Mobile | React Native |
| Backend | .NET 8 Web API |
| Operational DB | Azure SQL / SQL Server |
| Time-Series DB | Azure Data Explorer (ADX) |
| Cloud | Microsoft Azure |
| Identity | Azure AD (Entra ID) |
| IoT | Azure IoT Hub, Event Hub |
| Integration | Azure Service Bus, Azure Functions |
| Analytics | Azure Data Lake, Azure OpenAI |
| Observability | Azure Monitor, Application Insights |

---

## Relationship to Current Codebase

The repository contains a **Phase 1 MVP prototype** (FastAPI + Next.js + PostgreSQL) with:

| Module | Prototype status |
|--------|------------------|
| Asset Registry | ✅ API + `/assets` MUI page |
| GIS Command Center | ✅ `/` with LeftSidebar, MapViewport, GISMap |
| Alarms | ✅ API + `/alarms` page |
| Health / Condition | ✅ API + `/health` page |
| Maintenance / Work Orders | ✅ API + `/maintenance` page |
| Inspections | ✅ API + `/inspections` page |
| Dashboards & Analytics | ✅ API + `/dashboard`, `/analytics` |
| Satellite Monitoring | ✅ Existing pipeline preserved |
| Azure AD / SCADA / SignalR | 📋 Target production (Release 2) |

Details: [IMPLEMENTATION.md](./IMPLEMENTATION.md). The enterprise docs define the **target production architecture** on Microsoft Azure with .NET 8.

---

## Document Control

| Field | Value |
|-------|-------|
| Owner | TAMS Program Office |
| Classification | Internal – Confidential |
| Review Cycle | Quarterly |
| Next Review | October 2026 |

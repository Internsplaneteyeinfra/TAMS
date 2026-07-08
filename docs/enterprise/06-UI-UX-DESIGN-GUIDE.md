# UI/UX Design Guide
## Transmission Asset Monitoring System (TAMS)

**Document ID:** TAMS-UX-001  
**Version:** 1.0  
**Date:** July 2026

---

## 1. Design Philosophy

TAMS follows **utility industry design standards** prioritizing clarity, situational awareness, and operational efficiency. Control room operators must parse critical information in seconds; executives need portfolio-level insight at a glance.

### Design Principles
1. **Clarity over decoration** – Data density without clutter
2. **Severity-driven color** – Consistent alarm color language
3. **Progressive disclosure** – Summary → detail → raw data
4. **Accessibility first** – WCAG 2.1 AA compliance
5. **Responsive operations** – Desktop-first; tablet/mobile for field

---

## 2. Design System

### 2.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#1565C0` | Navigation, primary actions (utility blue) |
| Primary Dark | `#0D47A1` | Headers, sidebar |
| Secondary | `#00838F` | Secondary actions, links |
| Background | `#F5F7FA` | Page background |
| Surface | `#FFFFFF` | Cards, panels |
| Text Primary | `#1A2332` | Body text |
| Text Secondary | `#64748B` | Labels, captions |
| Critical | `#D32F2F` | Critical alarms, errors |
| High | `#F57C00` | High severity |
| Medium | `#FBC02D` | Medium severity |
| Low | `#1976D2` | Low severity |
| Success | `#2E7D32` | Healthy, completed |
| Warning | `#ED6C02` | Warnings |
| Border | `#E2E8F0` | Dividers, card borders |

### 2.2 Typography (Material UI)

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | Roboto | 32px | 700 |
| H2 | Roboto | 24px | 600 |
| H3 | Roboto | 20px | 600 |
| Body | Roboto | 14px | 400 |
| Caption | Roboto | 12px | 400 |
| KPI Value | Roboto Mono | 36px | 700 |
| Alarm Title | Roboto | 14px | 600 |

### 2.3 Component Library
Material UI v5+ with custom theme overrides:
- `TamsAppBar` – Top navigation with alarm badge
- `TamsSidebar` – Collapsible module navigation
- `TamsKpiCard` – KPI metric with trend indicator
- `TamsAlarmChip` – Severity-colored alarm badge
- `TamsAssetCard` – Asset summary with health gauge
- `TamsDataGrid` – Sortable/filterable data tables
- `TamsTrendChart` – Time-series line chart
- `TamsHealthGauge` – Circular health score (0–100)
- `TamsMapPanel` – GIS map container
- `TamsTimeline` – Event timeline component

### 2.4 Spacing & Layout
- Grid: 12-column, 24px gutter
- Card padding: 24px
- Sidebar width: 260px (expanded), 64px (collapsed)
- Content max-width: 1440px (dashboards), full-width (GIS)

---

## 3. Wireframes

### 3.1 Login Screen

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ┌─────────────────────┐                  │
│                    │                     │                  │
│                    │   [TAMS Logo]       │                  │
│                    │                     │                  │
│                    │ Transmission Asset  │                  │
│                    │ Monitoring System   │                  │
│                    │                     │                  │
│                    │ ┌─────────────────┐ │                  │
│                    │ │ Sign in with    │ │                  │
│                    │ │ Microsoft       │ │                  │
│                    │ │ [Azure AD SSO]  │ │                  │
│                    │ └─────────────────┘ │                  │
│                    │                     │                  │
│                    │ MFA required for    │                  │
│                    │ all accounts        │                  │
│                    │                     │                  │
│                    │ v1.0 | © 2026      │                  │
│                    └─────────────────────┘                  │
│                                                             │
│              Background: subtle grid/line pattern           │
└─────────────────────────────────────────────────────────────┘
```

**Elements:**
- Utility branding (logo, company name)
- Single SSO button (Azure AD) – no local password
- MFA notice
- No registration (admin-provisioned accounts)

---

### 3.2 Home Dashboard (Operations)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡] TAMS          🔍 Search assets...          🔔 12  👤 Rajesh Sharma  │
├────────┬─────────────────────────────────────────────────────────────────┤
│        │  Operations Dashboard                    Last updated: 09:58  │
│ 📊 Dash│                                                                 │
│ 🗺 GIS │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ ⚡ Mon │  │ Active   │ │ Critical │ │ System   │ │ Assets   │          │
│ 🔔 Alm │  │ Alarms   │ │ Alarms   │ │ Load     │ │ Monitored│          │
│ 🔧 Maint│  │   47     │ │    3     │ │  4,250MW │ │  19,842  │          │
│ 📋 Insp│  │ ↑ 5 today│ │ ↓ 1      │ │ → stable │ │          │          │
│ 📈 Anly│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│ ⚙ Admin│                                                                 │
│        │  ┌─────────────────────────────┐ ┌───────────────────────────┐│
│        │  │ Active Alarms          [All]│ │ Live Load Trend           ││
│        │  │ ─────────────────────────── │ │                           ││
│        │  │ 🔴 TX-OIL-TEMP SS-401  2m  │ │    ╱‾‾╲                   ││
│        │  │ 🟠 SF6-LOW     SS-220  8m  │ │   ╱    ╲___/‾‾            ││
│        │  │ 🟠 LINE-SAG    LN-102  15m │ │  ╱                        ││
│        │  │ 🟡 RELAY-TRIP  SS-315  22m │ │ ╱                         ││
│        │  │ [View All Alarms →]         │ │ 06:00  09:00  12:00  Now  ││
│        │  └─────────────────────────────┘ └───────────────────────────┘│
│        │                                                                 │
│        │  ┌─────────────────────────────┐ ┌───────────────────────────┐│
│        │  │ Substation Status Map       │ │ Recent Events             ││
│        │  │                             │ │ ─────────────────────────  ││
│        │  │    [Mini GIS Map]           │ │ 09:45 Alarm: TX-OIL-TEMP  ││
│        │  │    ● Green  ● Yellow        │ │ 09:30 SCADA: Load spike   ││
│        │  │    ● Red    ● Gray          │ │ 09:15 WO Completed: PM-442││
│        │  │                             │ │ 08:50 Inspection uploaded ││
│        │  └─────────────────────────────┘ └───────────────────────────┘│
└────────┴─────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Asset Details Page

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Back to Assets    SS-401-TX-01    Power Transformer    ● Critical     │
├──────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Monitoring] [Health] [Alarms] [Maintenance] [Inspections]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  Asset Information                                 │
│  │                 │  ─────────────────────────────────────────────     │
│  │  Health Gauge   │  Manufacturer: ABB    Serial: TX-2020-88421         │
│  │     78.5        │  Installed: 2020-03-15  Warranty: 2025-03-15      │
│  │   Good (C2)     │  Voltage: 400 kV      Capacity: 315 MVA            │
│  │                 │  Location: 19.076°N, 72.877°E (Aarey SS)           │
│  │  RUL: 84 months │  Status: In Service   Criticality: Critical        │
│  └─────────────────┘  Tags: [400kV] [critical] [dga-enabled]            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Live Monitoring                                                   │   │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│   │
│  │ │ Oil Temp │ │ Winding  │ │ Load     │ │ Voltage  │ │ DGA H2   ││   │
│  │ │  62.3°C  │ │  78.1°C  │ │ 245 MVA  │ │ 398 kV   │ │ 45 ppm   ││   │
│  │ │  Normal  │ │  Normal  │ │  78%     │ │  Normal  │ │  Normal  ││   │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘│   │
│  │ [24h Trend Chart ──────────────────────────────────────────────] │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ Asset Hierarchy        │  │ QR Code                                │ │
│  │ ▼ SS-401 Aarey SS     │  │  [QR]  Scan for mobile lookup          │ │
│  │   ▼ SS-401-BAY-03     │  │                                        │ │
│  │     ● SS-401-TX-01 ◀  │  │  [Generate QR] [Print Label]           │ │
│  └────────────────────────┘  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 GIS Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ GIS Command Center                    [Layers ▼] [Tools ▼] [3D View]    │
├────────┬─────────────────────────────────────────────────────────────────┤
│ Layers │                                                                 │
│ ☑ Lines│              ┌─────────────────────────────────────┐           │
│ ☑ Towers│              │                                     │           │
│ ☑ Subs │              │         [Full GIS Map View]          │           │
│ ☑ Faults│              │                                     │           │
│ ☑ Alarms│              │    ─── 400kV Line                   │           │
│ ☐ Crews│              │    ▲ Tower    ■ Substation          │           │
│ ☐ Risk │              │    🔴 Fault Location                 │           │
│        │              │                                     │           │
│ Filter │              └─────────────────────────────────────┘           │
│ ────── │  ┌──────────────────────────────────────────────────────────┐  │
│ Voltage│  │ Selected: Tower T-4521 (LN-102)                        │  │
│ [400kV]│  │ Line: LN-102 Mumbai-Pune  │ Structure: Suspension       │  │
│ Status │  │ Health: 82  │ Last Inspection: 2026-05-15              │  │
│ [All ▼]│  │ [View Asset] [Create WO] [Show on Map]                   │  │
│        │  └──────────────────────────────────────────────────────────┘  │
│ Search │  ┌──────────────────────────────────────────────────────────┐  │
│ [____] │  │ Geospatial Analytics                                     │  │
│        │  │ Proximity: 12 towers within 5km of fault                 │  │
│        │  │ Risk: 3 towers in high-risk corridor                     │  │
│        │  └──────────────────────────────────────────────────────────┘  │
└────────┴─────────────────────────────────────────────────────────────────┘
```

---

### 3.5 Alarm Center

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Alarm Center                    Active: 47  │ Critical: 3  │ High: 8   │
├──────────────────────────────────────────────────────────────────────────┤
│ [Active] [Acknowledged] [Closed] [All]     Filter: [Severity ▼] [Type ▼]│
├──────────────────────────────────────────────────────────────────────────┤
│ Sev │ Alarm Code      │ Asset          │ Value    │ Time   │ Status │ Act│
│ ─── │ ─────────────── │ ────────────── │ ──────── │ ────── │ ────── │ ── │
│ 🔴  │ TX-OIL-TEMP-HI  │ SS-401-TX-01   │ 87.5°C   │ 2m ago │ Active │[Ack│
│ 🔴  │ TX-DGA-C2H2     │ SS-220-TX-03   │ 8.2 ppm  │ 5m ago │ Active │[Ack│
│ 🔴  │ LINE-FAULT      │ LN-102 T-4521  │ —        │ 12m ago│ Active │[Ack│
│ 🟠  │ SF6-PRESS-LOW   │ SS-315-CB-02   │ 4.8 bar  │ 8m ago │ Ack'd  │[Cls│
│ 🟡  │ RELAY-EVENT     │ SS-401-RLY-01  │ Trip #47 │ 22m ago│ Active │[Ack│
├──────────────────────────────────────────────────────────────────────────┤
│ Alarm Detail: TX-OIL-TEMP-HI                                             │
│ ─────────────────────────────────────────────────────────────────────    │
│ Asset: SS-401-TX-01 (400kV Transformer, Aarey SS)                       │
│ Trigger: Oil Temperature 87.5°C (Threshold: 85°C)                     │
│ Generated: 2026-07-06 09:45:00  │  Escalation: Level 1 (L1 notified)   │
│ [Acknowledge] [Create Work Order] [View on GIS] [View Trend]            │
│ Audit: Generated → L1 Teams notification sent 09:45:05                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Maintenance Center

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Maintenance Center           Open WOs: 34  │ PM Compliance: 92%        │
├──────────────────────────────────────────────────────────────────────────┤
│ [Work Orders] [Schedule] [Calendar] [Spare Parts]                       │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─ Work Order Queue ──────────────────────────────────────────────────┐  │
│ │ #WO-2026-0847 │ PdM │ High │ SS-401-TX-01 │ DGA Analysis │ Jul 15  │  │
│ │ #WO-2026-0846 │ PM  │ Med  │ SS-220-CB-01 │ Annual Insp  │ Jul 12  │  │
│ │ #WO-2026-0845 │ CM  │ High │ LN-102 T-4521│ Insulator Rpl│ Jul 10  │  │
│ │ #WO-2026-0844 │ EM  │ Crit │ SS-315-TX-02 │ Oil Leak     │ Jul 06  │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│ ┌─ Schedule (Week View) ──────────────┐ ┌─ Crew Utilization ──────────┐│
│ │ Mon  Tue  Wed  Thu  Fri  Sat  Sun  │ │ Team Alpha:  ████████░░ 80% ││
│ │ [WO] [WO]      [WO][WO]             │ │ Team Beta:   ██████░░░░ 60% ││
│ │      [WO] [WO]      [WO]            │ │ Team Gamma:  ████░░░░░░ 40% ││
│ └─────────────────────────────────────┘ └─────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 3.7 Inspection Portal

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Inspection Portal                    Pending: 8  │ Completed: 142 (YTD)│
├──────────────────────────────────────────────────────────────────────────┤
│ [Scheduled] [In Progress] [Completed] [+ New Inspection]                │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─ Inspection Form ──────────────────────────────────────────────────┐   │
│ │ Asset: [LN-102 T-4521 ▼]    Type: [Drone ▼]    Date: [Jul 06]    │   │
│ │ Inspector: Priya Sharma                                            │   │
│ │ ─────────────────────────────────────────────────────────────────  │   │
│ │ Observations:                                                      │   │
│ │ [Insulator surface cracking observed on phase B...]                │   │
│ │                                                                    │   │
│ │ Defects:                                                           │   │
│ │ [+ Add Defect]  Type: Insulator  Severity: High  GPS: Auto        │   │
│ │                                                                    │   │
│ │ Attachments:                                                       │   │
│ │ [📷 Upload Photos] [🎥 Upload Video] [Drag & Drop Area]           │   │
│ │ ┌────┐ ┌────┐ ┌────┐                                              │   │
│ │ │img1│ │img2│ │img3│  AI Analysis: 2 defects detected (87% conf)│   │
│ │ └────┘ └────┘ └────┘                                              │   │
│ │                                                                    │   │
│ │ Overall Score: [72 / 100]    [Save Draft] [Submit Inspection]     │   │
│ └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 3.8 Analytics Dashboard (Executive)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Executive Dashboard                              Period: YTD 2026        │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ SAIDI    │ │ SAIFI    │ │ Availabil│ │ MTBF     │ │ Maint    │       │
│ │ 45.2 min │ │ 1.82     │ │ 99.4%    │ │ 8,420 hr │ │ $12.4M   │       │
│ │ ↓ 12.5%  │ │ ↓ 8.3%   │ │ ↑ 0.2%   │ │ ↑ 15%    │ │ ↓ 5.1%   │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                                          │
│ ┌─ Risk Portfolio Heatmap ──────────┐ ┌─ Outage Trends ───────────────┐ │
│ │ [Choropleth map by region]        │ │ [Monthly bar chart]           │ │
│ │ Western: 12 critical assets       │ │ Jan Feb Mar Apr May Jun       │ │
│ │ Central: 8 critical assets        │ │ Planned vs Unplanned outages  │ │
│ └───────────────────────────────────┘ └───────────────────────────────┘ │
│                                                                          │
│ ┌─ Top 10 At-Risk Assets ──────────────────────────────────────────┐   │
│ │ Rank │ Asset          │ Type        │ Risk │ RUL   │ Action        │   │
│ │ 1    │ SS-401-TX-01   │ Transformer │ 85   │ 18 mo │ DGA scheduled │   │
│ │ 2    │ SS-220-TX-03   │ Transformer │ 82   │ 24 mo │ Inspection    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│ [Export PDF Report] [Schedule Email Report]                              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 3.9 Administration Portal

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Administration                                                           │
├────────┬─────────────────────────────────────────────────────────────────┤
│ Users  │ User Management                              [+ Add User]      │
│ Roles  │ ───────────────────────────────────────────────────────────── │
│ Alarm  │ Name              │ Email              │ Roles     │ Active │
│ Rules  │ Rajesh Sharma     │ rajesh@utility.com │ Ops Eng   │ ✓      │
│ Notif. │ Priya Patel       │ priya@utility.com  │ Maint Eng │ ✓      │
│ Audit  │ Amit Kumar        │ amit@utility.com   │ Asset Eng │ ✓      │
│ System │ ───────────────────────────────────────────────────────────── │
│        │ Role Permissions Matrix                                          │
│        │ Module       │ Admin │ Ops │ Maint │ Asset │ Field │ Exec    │
│        │ Assets       │ CRUD  │ R   │ R     │ CRU   │ R     │ R       │
│        │ Alarms       │ CRUD  │ CRU │ R     │ R     │ R     │ R       │
│        │ Maintenance  │ CRUD  │ R   │ CRUD  │ R     │ RU    │ R       │
└────────┴─────────────────────────────────────────────────────────────────┘
```

---

## 4. Mobile App Design (React Native)

### 4.1 Screen Flow

```
Login (SSO) → Home → [Asset Lookup | Work Orders | Inspections | Notifications]
                │
                ├── Asset Lookup (QR Scan / Search) → Asset Detail
                ├── Work Orders → WO Detail → Execute → Complete (signature)
                ├── Inspections → Form → Capture Photos → Submit (offline queue)
                └── Notifications → Alarm/WO detail
```

### 4.2 Key Mobile Screens

**Home:** Quick actions (Scan QR, My WOs, New Inspection), notification badge  
**Work Order Execution:** Checklist, photo capture, GPS auto-tag, timer, digital sign-off  
**Offline Mode:** Yellow banner "Offline – changes will sync"; local SQLite queue  
**Inspection Form:** Simplified version of web portal; camera integration; voice notes

### 4.3 Mobile Design Tokens
- Touch targets: minimum 48×48 dp
- Bottom navigation: Home, WOs, Inspect, Scan, Profile
- Primary action: FAB (Floating Action Button) for new inspection

---

## 5. Accessibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| Color contrast | 4.5:1 minimum for text |
| Alarm severity | Color + icon + text label (not color alone) |
| Keyboard navigation | Full tab order; skip links |
| Screen reader | ARIA labels on all interactive elements |
| Focus indicators | Visible 2px outline on focus |
| Motion | Respect prefers-reduced-motion |

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Desktop | ≥ 1280px | Full sidebar + content |
| Tablet | 768–1279px | Collapsed sidebar; stacked cards |
| Mobile | < 768px | Bottom nav; single column (mobile app preferred) |

---

**Maintained By:** UX Design Team

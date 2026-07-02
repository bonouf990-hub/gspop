# ARENCO One — Build Status & Guide

**Estate operations platform — what has been built, how it works, and what comes next.**
Status as of 2 July 2026. Grouped by the department that owns each module.

Status key: **Live** (working now) · **Partial** (exists, being connected) · **Planned** (next to build).

---

## How the operation flows

The platform mirrors ARENCO's real departments. Work passes between them along three routes:

**Routine maintenance** — Resident/Help Desk raises a request → Maintenance attends on a **Job Card** → needs a part → **Store Requisition** (no PO) → fitted, Job Card closed.

**Store replenishment** — Stock drops below reorder level → Purchasing raises a **Purchase Order** (bulk — the only PO) → goods received into the Store.

**Major maintenance** — Head of Maintenance prepares a **BOQ** → Purchasing releases a **Tender** → vendors site-visit & quote → award → subcontractor does the work.

> **Rule of thumb:** a Purchase Order is raised *only* for bulk stock into the Store. Routine repairs draw parts from the Store on a requisition — never a PO. Major works go to tender.

---

## Foundation — the data everything hangs on

| Module | Status | For / How |
|---|---|---|
| **Buildings & Portfolio** | Live | Your whole portfolio — buildings, floors, apartments, common areas. Bulk-upload from one file; buildings reused by name. Data prepared: 24 buildings, 2,958 apartments — loading from the backend. |
| **Asset Register** | Live | Every piece of equipment (Building → Floor → Apartment/Common → Equipment) with make/model/serial, warranty, cost, criticality, condition, QR tag. Bulk-import register + service history; edit/log from the back end. Lifetime cost folds prior history + logged services + work orders, flags replace-vs-repair. |

## Maintenance & Engineering

| Module | Status | For / How |
|---|---|---|
| **Job Cards / Work Orders** | Live | Corrective jobs from receipt to close — assign, track through full status flow, before/after photos, cost. Shares a case number with its complaint. |
| **Complaints & Help Desk** | Live | Resident issues logged with damage photos, triaged, converted to a Job Card on the same case number (MC-YYYY-NNNN). |
| **Preventive Maintenance (PPM)** | Live | Schedules auto-raise Job Cards when due, by asset and cycle. |
| **Approvals** | Partial | Queue of spend/escalations for sign-off. *Next: wire the approval matrix to spend limits.* |
| **Call Center** | Live | Identify a caller and open a complaint against their apartment. |
| **Compliance** | Partial | Civil Defence, lift inspections, DM reports, document expiry. *Next: tie expiries to assets and reminders.* |

## Store & Inventory

| Module | Status | For / How |
|---|---|---|
| **Store & Dispatch** | Live | Fulfils parts requisitions from Maintenance — pick, issue, deliver from stock; consumption tracked by apartment/building. |
| **Inventory / Stock** | Live | Stock on hand, reorder thresholds, unit cost, movements. Bulk-import the whole stock position. Low stock triggers a PO to Purchasing. |
| **Raise Requisition from a Job Card** | Planned | On a Job Card, request a part → lands in the Store as a requisition → stock drops → auto-flags Purchasing if below reorder. The next connection to build. |

## Purchasing & Contracts

| Module | Status | For / How |
|---|---|---|
| **Purchasing / Purchase Orders** | Partial | Bulk stock into the Store and awarded-tender POs. *Next: budget guard before approval; bridge to JD ERP.* |
| **Tenders** | Live | Publish BOQ → vendors register & site-visit → submit quotes online → scored → award → flows to a PO. |
| **Vendors & Contracts** | Partial | Vendor records, ratings, assignments, AMC contracts. *Next: AMC/warranty guard before charging a covered repair.* |
| **Invoices & Payments** | Live | Contractor invoices verified against their PO before payment is recorded. |

## Community & Residents

| Module | Status | For |
|---|---|---|
| **Residents & Leases** | Live | Onboarding, rent schedules, documents, automatic renewal reminders (90/60/30/10 days, configurable). |
| **Building Notices** | Live | Announcements posted to residents. |
| **Bookings** | Live | Common-area reservations — gym, pool, function rooms. |
| **Visitors & Security** | Live | Gate log, pre-authorised visitors, live check-in/out console. |
| **Resident Portal** | Live | Residents raise complaints with photos and follow progress. |

## Insight & Reporting

| Module | Status | For |
|---|---|---|
| **Analytics Dashboard** | Live | Occupancy, rent collection, turnaround, building health. |
| **AI Brain** | Live | Triage, budget forecasting, anomaly detection, predictive maintenance. |
| **Command Center** | Live | Live overview of jobs, contractors, stock alerts. |
| **Cost & Budgets** | Live | Per-building and per-apartment cost; annual budget spent vs remaining. |
| **Staff KPIs & Activity Log** | Live | Per-technician throughput and a full audit trail. |

## Across the whole platform

| Feature | Status | What it does |
|---|---|---|
| **Automatic photo compression** | Live | Complaint and before/after photos shrunk on the phone before upload — a 4–8 MB photo lands as ~300–500 KB. |
| **Bulk data loaders** | Live | Buildings, equipment, service history, inventory each load from one file with a validated preview. |
| **Renewal automation** | Live | Lease-renewal reminders fire on schedule and repeat until answered; fully configurable. |
| **Shared case numbers** | Live | A complaint and its work order share one number (MC-YYYY-NNNN). |

---

## What's next

**Immediate**
- Load buildings & apartments from the backend (24 buildings, 2,958 apartments)
- Common areas — from the prepared template
- Then equipment, service history and inventory on top

**Connecting the departments**
- Raise a Store requisition directly from a Job Card (no PO)
- Budget guard on Purchase Orders
- Approval matrix wired to spend limits
- AMC / warranty guard before charging a repair

**New AMFM modules**
- Building Systems Monitoring (HVAC, pumps, generators, fire, lifts)
- Utility Management
- Health, Safety & Environment (incidents, permit-to-work)
- Document Management
- JD Edwards ERP integration

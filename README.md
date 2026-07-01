# GSPOP — Golden Sands Enterprise Property Operations Platform

A standalone, multi-tenant, multi-property platform for property/asset management, maintenance,
purchasing, inventory, and approvals — built with anti-misuse controls (GPS check-in/out,
mandatory before/after photos, multi-level approvals with audit trail, role-based spend limits,
visitor logging, access/key control).

**This is a brand-new, isolated project.** It is not connected to any other Supabase project,
Vercel project, or codebase. Do not reuse credentials from other projects.

## Structure — separate frontends, one backend

Three lightweight, independently-deployed apps share one Supabase backend and the same
row-level-security rules. Each ships only the code its audience needs — a resident never
downloads the ops dashboard's bundle, and vice versa.

```
apps/ops-console    Next.js — managers/supervisors/admin. Data-dense: work orders,
                     approvals, complaints triage, compliance, visitor log.
apps/tenant-portal  Next.js — residents only. Minimal, fast, app-like: report an
                     issue, view requests, pay rent, see building notices.
apps/mobile         Expo/React Native — technicians. Job list, GPS check-in/out,
                     before/after photos, timer.
packages/shared      Shared TypeScript types + Supabase client used by all three.
database/migrations  SQL schema (run against a new Supabase project, in order).
```

Why split: different audiences need different performance budgets (a tenant on mobile data
needs sub-second loads; a manager on desktop reviewing 200 work orders can tolerate more), and
keeping resident-facing code physically separate from admin tooling reduces what a bug or leak
in one surface can expose.

## Current scope

- Multi-tenant schema with RLS: tenants, properties, units, common areas, assets (with full
  lifecycle/spare-parts tracking), leases, work orders, complaints, approvals, purchase orders,
  inventory, visitors, access credentials, preventive-maintenance schedules, utility meters,
  compliance/document expiry, budgets, audit log.
- **ops-console**: Work Orders, Approvals, Complaints (with recurring-issue detection), Compliance,
  Visitor Log.
- **tenant-portal** (resident surface — feature-complete): home dashboard (apartment details,
  equipment, rent-due banner, profile + notifications), report an issue with photo upload,
  my requests with a status-tracked detail view, rent as a cheque schedule with printable
  receipts, building notices, in-app notifications, visitor pre-authorization, a profile page
  (photo, phone/email, sign out), lease documents (contract/Ejari/receipts), and password reset.
- **ops-console** management for the tenant surface: a navigation dashboard, Residents & Leases
  (onboard residents, rent terms, per-lease cheque schedule, documents), Building Notices, and
  complaint triage that shows resident photos and pushes status updates back to residents.
- **mobile**: technician job list, job detail with mandatory before-photo → GPS check-in → timer →
  after-photo → GPS check-out sequence.

## Setup

1. Create a **new** Supabase project (not linked to any existing one). Run all files in
   `database/migrations/` **in order** (0001 → 0022) against it. The later migrations create
   the private storage buckets they need (`unit-photos`, `complaint-photos`, `avatars`,
   `lease-documents`) via `storage.buckets`, so no manual bucket setup is required.
2. Copy each app's `.env.example` to `.env.local` (`.env` for mobile) and fill in the new
   project's URL/anon key.
3. From the repo root: `npm install`
4. `npm run dev:ops` / `npm run dev:tenant` / `npm run dev:mobile`
5. Deploy `ops-console` and `tenant-portal` as two **separate new** Vercel projects (different
   subdomains, e.g. `app.gspop.com` and `my.gspop.com`) — not existing ones.

## Deferred to V2 (schema ready, no UI yet)

Utility meter anomaly dashboards, budget actual-vs-budgeted rollups, common-area booking UI,
access-card admin screens, the automated preventive-maintenance scheduler job, move-in/move-out
checklist UI, AI predictive maintenance, IoT/ERP/BMS integrations.

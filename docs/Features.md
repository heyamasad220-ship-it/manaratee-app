# FEATURES.md

# Feature Documentation

This document contains implementation notes and feature history for major Manaratee modules.

---

# Authentication

## Login Page

Status: Complete

### Improvements

* Increased logo size
* Removed footer links
* Improved mobile branding
* Kept responsive layout

### OAuth

Implemented:

* Google OAuth

Planned:

* Apple OAuth

### OAuth Flow

Uses:

* Supabase Authentication
* OAuth callback route
* Google Cloud OAuth credentials

---

# Roles, Permissions & Access Control

Status: Complete

## Architecture

Platform Owner:

* owner role reserved for platform owner

Organization Roles:

* organization_roles
* custom role names
* organization-specific permissions

Organization Members:

* organization_members.role
* organization_members.role_id

Permissions:

* role_permissions

---

## Features

Completed:

* Users page rebuilt
* Roles & Permissions page rebuilt
* Permission matrix
* Server-side protection
* Unauthorized page
* Permission-aware sidebar
* Subscription-aware modules

---

## Current Issue

User Invitations

File:

app/api/organizations/invite-user/route.ts

Status:

Working — requires Supabase email + redirect URL configuration (see `docs/Known_Issues.md`)

---

# Customer Portal

Status: Partial

## Organization Switching

Completed

Uses:

active_organization_id

Components:

* organization-switcher.tsx
* customer-nav.tsx
* switch-organization.ts

---

# Customer Programs

Status: Partial

Routes:

* /customer/programs
* /customer/programs/[id]
* /customer/programs/[id]/register

### Features

* Organization filtering
* Active program filtering
* Program cards
* Enrollment badges
* Loading states
* Empty states

### Current Issue

Customer membership lookup.

Possible causes:

* user_id mismatch
* NULL organization_members.user_id
* membership linked only by email

---

# Programs Module

Status: Active Development

## Programs

Completed:

* Program CRUD
* Departments
* Eligibility fields
* Registration types

---

## Program Sessions

Table:

program_sessions

Supported:

* Capacity
* Enrollment counts
* Pricing
* Registration windows

Decision:

Use program_sessions.

Do not use schedule_sessions.

---

## Lunch Options

Table:

program_lunch_options

Status:

Working

Current records:

* No Lunch
* Basic Lunch
* Hot Lunch

---

## Registration Types

Supported:

* Full Program Registration
* Session-Based Registration

Field:

session_registration_enabled

---

# Registrations

Status: Partial

## Tables

* program_enrollments
* program_waitlist
* registration_carts
* registration_orders

---

## Admin Registration Management

Routes:

* /programs/registrations
* /programs/registrations/enrollment/[id]
* /programs/registrations/waitlist/[id]

Features:

* Search
* Filters
* Stats
* Status changes
* Waitlist conversion

---

## Registration Fixes

Completed:

* Status constraint fix
* Lunch option loading fix

---

## Planned Improvements

* Enrollment-session linking
* Session capacity tracking
* Session-based registration workflow

---

# Financial Assistance

Status: Database Complete

## Program Settings

Added to programs:

* financial_assistance_enabled
* financial_assistance_open
* financial_assistance_close_date
* financial_assistance_instructions

---

## Tables

* program_financial_assistance
* program_financial_assistance_documents
* program_financial_assistance_status_history

---

## Customer Workflow

Planned Route:

/customer/programs/[id]/financial-assistance

Features:

* Application submission
* Document upload
* Status tracking

---

## Admin Workflow

Planned Routes:

* /programs/financial-assistance
* /programs/financial-assistance/[id]

Features:

* Review queue
* Approval workflow
* Status history

---

# Development Preferences

Always:

* Provide full files
* Provide exact SQL
* Provide permanent solutions
* Provide beginner-friendly instructions
* Inspect schema before creating tables
* Update `docs/` when making meaningful changes (see `docs/AI_INSTRUCTIONS.md`)

Avoid:

* Abstract explanations
* Mock data
* Duplicate systems
* Large rewrites

---

# People Management

Status: Active Development

Display label: **People Management** (module slug `hr`, routes `/hr/*`).

Migration: `scripts/013_rename_hr_module.sql` updates `modules.name` in the database.

---

## Module Rename

Completed:

* User-facing label changed from HR to People Management
* Sidebar uses `PEOPLE_MANAGEMENT_MODULE_LABEL` from `lib/hr/hr-module-label.ts`
* Page headers and copy updated across HR routes

Technical note: URL paths remain `/hr/*`; only display names changed.

---

## Employees Module Simplification

Completed:

* Tabs reduced to: Overview, Employees, Departments, Positions
* Removed: Time Off, Work Schedule, Notifications, Teams, Applications (as employee sub-tabs)
* Removed QuickBooks payroll/scheduling note from copy
* Employment applications linked from Employees header via `ModuleApplicationsLink`

Redirects:

* `/hr/time-off` → `/hr/employees?tab=overview`
* Old settings tab URLs for departments/positions → `/hr/employees?tab=...`

---

## Child Care

Status: Complete (data wiring)

Route: `/hr/childcare`

Completed:

* Moved under People Management at `/hr/childcare`
* Removed mock provider array
* Providers loaded from approved `childcare_provider` applications
* Summary stat cards preserved (blue/green/purple/amber color scheme)
* Provider detail dialog shows real `form_data` from applications
* Empty states for no providers and no event history
* Review Applications / Add Provider flows link to Applications Submissions tab

Pending:

* Event participation tracking (Total Hours, Events Worked, History tab)

Key files:

* `lib/hr/childcare-provider-actions.ts`
* `components/hr/hr-childcare-panel.tsx`

---

## People Management Settings

Completed:

* Removed General tab (fiscal year, timezone, employee ID format — was non-functional UI)
* Removed Roles tab from Settings UI
* Kept Discount Policies as the sole Settings content
* `/hr/discount-policies` redirects to `/hr/settings`

---

## Unified Applications Engine

Status: Active Development

Migration: `scripts/012_applications.sql`

### Database

Tables:

* `application_type_definitions`
* `applications`
* `application_history`
* `application_documents`

### Application Types (seeded)

| ID | Module |
|----|--------|
| volunteer | hr |
| employment | hr |
| committee_member | hr |
| childcare_provider | hr |
| vendor | vendor_hub |
| financial_aid | programs |

### Lib Layer

* `lib/applications/application-types.ts` — types, registry, PM hub type list
* `lib/applications/application-actions.ts` — server actions (list, stats, submit, review)
* `lib/applications/application-routes.ts` — URL builders
* `lib/applications/application-status-tabs.ts` — status tab definitions
* `lib/applications/application-nav.ts` — sidebar nav helpers

### UI

* `components/applications/applications-module-page.tsx` — shared list/dashboard component
* `components/applications/applications-overview-client.tsx` — cross-module overview
* `components/contacts/contact-applications-panel.tsx` — contact profile integration
* Application detail: `/applications/[id]`

### Sidebar Changes

Completed:

* Removed duplicate Applications under Vendor Hub settings path
* Single **Applications** entry under People Management
* Removed separate Pending / Approved / Rejected sidebar items (now status tabs/filters on one page)

---

## People Management Applications Page

Status: Active Development

Route: `/people-management/applications`

Completed:

* Three top-level tabs: **Overview**, **Submissions**, **Templates**
* Overview: stat cards, status shortcuts, per-type counts; clicks navigate to Submissions with filters
* Submissions: status tabs, search, type/status filters, applications table
* Templates: cards per PM application type with scaffold for future form builder
* Module shortcut links (Child Care, Employees, etc.) open Submissions tab with type filter
* `PEOPLE_MANAGEMENT_APPLICATIONS_HUB_TYPES` excludes employment from default hub view

URL behavior:

* `/people-management/applications` → Overview
* `?tab=submissions` → Submissions
* `?tab=templates` → Templates
* `?application_type=` or `?status=` → Submissions (auto)

Pending:

* Template form builder (Configure Fields)
* Custom org-defined application types in UI

Key files:

* `components/applications/people-management-applications-client.tsx`
* `components/applications/application-templates-panel.tsx`

---

## Layout

Completed:

* Sidebar logo enlarged to fill header area (`components/layout/sidebar.tsx`)
* Scale applied to compensate for whitespace in `public/logo.png`

# ManarateeApp Development Summary

## Project Overview

### Tech Stack

* Next.js App Router
* TypeScript
* Supabase
* Tailwind CSS
* shadcn/ui

### Multi-Tenant Architecture

Implemented and working:

* organizations
* organization_members
* organization_roles
* role_permissions
* permission-aware sidebar
* subscription-aware modules
* server-side route protection
* unauthorized page
* custom organization roles
* granular permissions

### Role Structure

```text
organization_members.role
```

Hidden system/platform role.

Examples:

```text
owner
super_admin
admin
customer
```

```text
organization_members.role_id
```

Visible organization role linked to:

```text
organization_roles
```

Examples:

```text
Super Admin
Program Director
Volunteer Coordinator
```

Important:

```text
owner
```

is reserved for platform owner only.

---

# Customer Portal

## Organization Switching

Permanent fix completed.

Uses:

```text
active_organization_id
```

cookie.

Components:

```text
components/organization-switcher.tsx
components/customer-nav.tsx
app/(customer)/actions/switch-organization.ts
```

Customer can switch organizations.

All customer pages use selected organization.

---

# Programs Module

## Programs Table

Current columns include:

```text
id
organization_id
name
description
department_id
start_date
end_date
enrollment_open_date
enrollment_close_date
age_groups[]
grade_levels[]
gender
capacity
enrolled
waitlist
status
created_at
updated_at
```

---

# Customer Programs

Working routes:

```text
/ customer/programs
/ customer/programs/[id]
/ customer/programs/[id]/register
```

Customer programs page only shows:

```text
status = active
```

Programs.

Organization filtering is working.

---

# Registrations Module

## Tables

### program_enrollments

```text
program_id
child_name
parent_name
parent_email
parent_phone
status
payment_status
amount_paid
total_amount
weeks[]
before_care
after_care
notes
```

### program_waitlist

```text
program_id
child_name
parent_name
parent_email
parent_phone
preferred_weeks[]
position
status
priority
offer_expiry
notes
```

---

# Admin Registrations Page

Route:

```text
/programs/registrations
```

Rebuilt using real data.

No more mock data.

Supports:

* enrollments
* waitlist entries
* search
* filters
* stats cards

---

# Registration Detail Pages

Implemented:

```text
/programs/registrations/enrollment/[id]
/programs/registrations/waitlist/[id]
```

Actions implemented:

### Enrollment

* change status
* mark payment status
* cancel enrollment

### Waitlist

* move to enrollment
* remove from waitlist

---

# Important Discovery

Current database contains:

```text
0 rows in program_enrollments
0 rows in program_waitlist
```

Therefore registration pages correctly show:

```text
No registrations found
```

Customer registration currently fails during submission and still needs debugging later.

Error shown:

```text
We could not save this registration. Please try again.
```

Registration debugging postponed.

---

# Financial Assistance System

## Goal

Per-program financial assistance applications.

Each program can independently:

* enable financial assistance
* disable financial assistance
* open applications
* close applications
* set close date
* display instructions

---

# Database Changes Completed

## programs table

Added:

```sql
financial_assistance_enabled boolean
financial_assistance_open boolean
financial_assistance_close_date date
financial_assistance_instructions text
```

---

## program_financial_assistance table

Expanded to support full application workflow.

Added:

```text
organization_id
program_id
submitted_by

applicant_type
applicant_name
applicant_email
applicant_phone

child_name
child_date_of_birth
child_age
child_gender
child_grade_level

program_cost

assistance_type_requested
can_contribute
amount_can_pay

household_size
number_of_adults
number_of_children
household_income_range
household_assistance[]

special_circumstances
additional_notes

volunteer_interest
volunteer_areas[]
volunteer_skills
languages_spoken
volunteer_availability

agreement_accepted

submitted_at

reviewed_by
reviewed_at
review_status

approved_assistance_type
applicant_contribution_amount
payment_schedule
follow_up_needed
approval_date

answers jsonb
```

---

## New Tables Created

### program_financial_assistance_status_history

Stores:

* status changes
* notes
* changed_by
* timestamps

### program_financial_assistance_documents

Stores:

* proof of income uploads
* supporting documents

---

# Financial Assistance Application Requirements

Application supports:

## Applicant Information

* Email
* Name
* Phone
* Applicant Type

```text
Adult Applicant
Parent/Guardian Applying for Minor
```

## Child Information

Conditional.

Only visible when applying for a minor.

## Program Information

* Program
* Department
* Start Date
* Program Cost

## Assistance Request

```text
Full Scholarship
Partial Scholarship
Payment Plan
Other
```

## Household Information

Includes:

* household size
* income range
* public assistance programs

## Financial Need

* circumstances
* proof of income
* notes

## Volunteer Interest

Optional.

Not required for approval.

## Admin Review

Admin-only fields:

```text
Approved
Denied
Needs More Information
```

Includes:

* approved amount
* contribution amount
* payment schedule
* follow-up
* notes

---

# Program Edit Page Changes

Using:

```text
app/(dashboard)/programs/[id]/edit/edit-program-form.tsx
```

Decision:

Financial assistance settings belong inside the existing program edit page.

No separate financial assistance settings route needed.

---

# Files Updated

## program-types.ts

Added:

```ts
financial_assistance_enabled: boolean
financial_assistance_open: boolean
financial_assistance_close_date: string | null
financial_assistance_instructions: string | null
```

---

# Remaining Work

## Update Program Type

File:

```text
lib/programs/program-actions.ts
```

Update:

```ts
type UpdateProgramInput
```

Add:

```ts
financial_assistance_enabled?: boolean
financial_assistance_open?: boolean
financial_assistance_close_date?: string | null
financial_assistance_instructions?: string | null
```

Also add these fields to the Supabase update payload.

This is the current blocker causing TypeScript errors in the edit form.

---

# Next Development Steps

## 1. Finish Program Edit Save Logic

Update:

```text
lib/programs/program-actions.ts
```

to save financial assistance settings.

## 2. Verify Program Edit Page

Confirm:

* enable toggle saves
* open toggle saves
* close date saves
* instructions save

## 3. Build Customer Financial Assistance Flow

New route:

```text
/ customer/programs/[id]/financial-assistance
```

Features:

* conditional fields
* application submission
* proof-of-income upload
* status tracking
* admin review workflow

## 4. Build Admin Financial Assistance Dashboard

Routes:

```text
/ programs/financial-assistance
/ programs/financial-assistance/[id]
```

Features:

* application queue
* review workflow
* approval workflow
* history tracking

## Development Preferences

Always provide:

* full files
* exact code replacements
* exact SQL
* permanent solutions
* beginner-friendly instructions

Always inspect existing schema before changing database structure.

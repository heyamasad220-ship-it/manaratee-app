# Customer Programs Page Implementation

## Goal

Create a customer-facing Programs page that displays programs created by the organization on the admin side.

Requirements:

- Match the Donations page style and layout
- Display programs from the `programs` table
- Filter by the logged-in customer's organization
- Support after-school programs, camps, and adult classes
- Use existing Supabase architecture

---

# Database Verification

Verified that programs exist in the database.

Example columns:

```sql
programs
---------
id
organization_id
name
description
department_id
start_date
end_date
enrollment_open_date
enrollment_close_date
age_groups
grade_levels
```

Programs are correctly tied to an organization via:

```sql
organization_id
```

---

# Initial Issue

Customer page displayed:

```txt
Unable to load programs
You are not connected to an organization yet.
```

Even though:

- Customer is logged in
- RLS policies exist
- Programs exist in database

---

# Architecture Discovery

The application uses Client Components.

Example working page:

```tsx
"use client"

import { createClient } from "@/lib/supabase/client"
```

The original Programs page was incorrectly written as a Server Component.

Incorrect:

```tsx
export default async function CustomerProgramsPage()
```

Correct:

```tsx
"use client"

export default function CustomerProgramsPage()
```

---

# Programs Page Rebuild

Rebuilt Programs page using:

```tsx
useState()
useEffect()
createClient()
```

Features:

- Total Programs
- Enrollment Open count
- Upcoming Programs count
- Grade Levels count
- Program cards
- Enrollment status badges
- Date formatting
- Loading state
- Empty state
- Error state

---

# Supabase Query

Programs are loaded using:

```tsx
const { data } = await supabase
  .from("programs")
  .select("*")
  .eq("organization_id", membership.organization_id)
  .order("start_date", { ascending: true })
```

---

# Organization Membership Check

Current query:

```tsx
const { data: memberships } = await supabase
  .from("organization_members")
  .select("*")
  .eq("user_id", user.id)
```

Verified schema:

```sql
organization_members
--------------------
id
user_id
organization_id
role
role_id
email
first_name
last_name
status
created_at
updated_at
invited_at
accepted_at
```

Confirmed:

```sql
user_id
```

exists.

---

# Current Debugging Step

Added diagnostics:

```tsx
console.log("Logged in user id:", user.id)
console.log("Logged in user email:", user.email)
console.log("Memberships found:", memberships)
console.log("Membership error:", membershipError)
```

Purpose:

Determine whether:

```txt
auth.users.id
```

matches:

```txt
organization_members.user_id
```

---

# Next SQL Debug Query

Run:

```sql
select
  id,
  user_id,
  email,
  first_name,
  last_name,
  organization_id,
  status
from organization_members
where email = 'CUSTOMER_EMAIL_HERE';
```

Compare:

```txt
organization_members.user_id
```

with:

```txt
user.id returned by Supabase Auth
```

---

# Expected Root Cause

Most likely one of:

1. `organization_members.user_id` is NULL
2. `organization_members.user_id` does not match auth user ID
3. Membership record exists under email but not linked to auth user

Result:

Programs query never executes because membership lookup fails first.

---

# File Being Worked On

```txt
app/(customer)/customer/programs/page.tsx
```

---

# Relevant Tables

```txt
organizations
organization_members
organization_roles
profiles
customer_profiles
programs
program_enrollments
program_waitlist
program_payment_plans
program_extended_care
program_financial_assistance
```

---

# Status

Programs page UI successfully created.

Current blocker:

```txt
Customer membership lookup is failing.
```

Need to verify:

organization_members.user_id == auth.users.id
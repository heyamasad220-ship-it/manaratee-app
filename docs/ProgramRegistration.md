# Program Registration System Refactor Notes

## Overview

Worked on improving the Program Registration system for both Admin and Customer portals.

Goals:

* Remove hardcoded registration options
* Use real Program Sessions from Supabase
* Use Lunch Options from Supabase
* Improve Eligibility UX
* Support both Full Program and Session-Based registration
* Prepare for future enrollment/session tracking

---

# Customer Registration Fixes

## Lunch Option Error

### Problem

Customer registration failed after selecting a lunch option.

Error:

```txt
new row for relation "program_enrollments"
violates check constraint
"program_enrollments_status_check"
```

### Cause

Registration page was inserting:

```ts
status: "enrolled"
```

Database only allows:

```txt
pending
confirmed
cancelled
```

### Fix

Changed registration insert to:

```ts
status: "pending"
```

---

# Lunch Options

## Problem

Lunch dropdown was empty.

### Cause

Registration page was querying:

```ts
lunch_options
```

Actual table:

```sql
program_lunch_options
```

### Additional Issue

RLS policy blocked customer access.

### Fix

Updated queries to:

```ts
.from("program_lunch_options")
```

Disabled RLS temporarily for testing.

Lunch options now load correctly.

Current records:

```txt
No Lunch
Basic Lunch
Hot Lunch
```

---

# Program Sessions

## Current Table

```sql
program_sessions
```

Contains:

```txt
program_id
organization_id
name
start_date
end_date
capacity
enrolled
waitlist
price
registration dates
```

### Decision

Use Program Sessions for customer registration.

Do NOT use:

```sql
schedule_sessions
```

because it is generic and not tied to programs.

---

# Session Registration Architecture

## Business Requirement

Some programs:

```txt
Summer Camp
```

Customer registers once for entire program.

Other programs:

```txt
Swimming Lessons
```

Customer can register for:

* Session 1
* Session 2
* Session 3
* Multiple sessions

---

## Recommended Design

Add to programs:

```sql
alter table programs
add column if not exists session_registration_enabled boolean
not null default false;
```

### Behavior

#### Full Program

```txt
session_registration_enabled = false
```

Customer registers for entire program.

No sessions displayed.

---

#### Session Based

```txt
session_registration_enabled = true
```

Customer chooses one or more sessions.

Sessions displayed during registration.

---

# Enrollment Architecture

Current enrollment table contains:

```txt
session_name
weeks[]
```

### Problem

Weeks are currently being used to store session IDs.

Not ideal long-term.

### Planned Solution

Create:

```sql
program_enrollment_sessions
```

Example:

```sql
create table program_enrollment_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  enrollment_id uuid not null,
  session_id uuid not null,
  created_at timestamptz default now()
);
```

Benefits:

```txt
1 Enrollment
→ Multiple Sessions
```

Supports swim lessons and multi-session programs.

---

# Program Create Form

## Current Improvements

Added:

```txt
Registration Type
```

Options:

```txt
Full Program Registration
Session-Based Registration
```

Stores:

```txt
session_registration_enabled
```

---

# Eligibility Refactor

## Old Design

```txt
Age Groups
Grade Levels
Gender
```

Age Groups generated from min/max ages.

Inconsistent.

---

## New Design

Use actual fields:

```txt
Minimum Age
Maximum Age
Grade Levels
Gender
```

Database fields:

```txt
min_age
max_age
grade_levels
gender
```

Rules:

### No Restrictions

```txt
No minimum age
No maximum age
All grades
All genders
```

### Restricted

Example:

```txt
Minimum Age: 4
Maximum Age: 14

Grades:
Pre-K
Kindergarten
1st Grade
...

Gender:
All Genders
```

---

# Grade Level UI

## Issue

Grade level dropdown was clipped behind page footer.

### Temporary Fix

Moved away from dropdown approach.

### Future Goal

Use a cleaner inline selector.

Desired layout:

```txt
Restrictions

[Minimum Age]
[Maximum Age]
[Grade Levels]
[Gender]
```

All on a single row.

---

# Program Details Page

## Planned Changes

Remove:

```txt
Sessions Button
```

Current:

```txt
Program Details
→ Sessions
```

Desired:

```txt
Program Details
→ Registration Type
```

Example:

```txt
Registration Type:
Full Program
```

or

```txt
Registration Type:
Session Based
```

---

# Future Improvements

## Session Management

Move sessions directly into:

```txt
Edit Program
```

instead of maintaining a separate Sessions page.

Possible structure:

```txt
Overview
Eligibility
Sessions
Lunch Options
Discounts
```

Sessions only visible when:

```txt
session_registration_enabled = true
```

---

# Capacity Tracking

Current registration updates:

```txt
programs.enrolled
```

Future enhancement:

Also update:

```txt
program_sessions.enrolled
```

when a session is selected.

This keeps:

```txt
Program Capacity
Session Capacity
```

synchronized.

---

# Cleanup Performed

Reviewed:

* Customer Registration Page
* Program Create Form
* Program Details Page
* Program Sessions Page
* Program Actions
* Enrollment Structure

Removed test data concerns after deleted programs and discussed orphan enrollment cleanup queries.

---

# Current Status

Completed:

✅ Lunch options loading from Supabase

✅ Registration status constraint fixed

✅ Session registration architecture defined

✅ Registration type added

✅ Eligibility redesign planned

✅ Session-based program support planned

Pending:

⬜ Add session_registration_enabled column

⬜ Replace weeks[] with enrollment-session records

⬜ Update customer registration flow

⬜ Redesign eligibility display

⬜ Remove Sessions button from details page

⬜ Move session management into program edit experience

⬜ Track per-session enrollment counts

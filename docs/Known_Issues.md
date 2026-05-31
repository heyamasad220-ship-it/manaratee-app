# KNOWN_ISSUES.md

## User Invitations

Status: Open

File:

app/api/organizations/invite-user/route.ts

Potential Causes:

* Supabase invite configuration
* Email provider issues
* Missing redirect URL
* Missing environment variables
* organization_members insert failure
* role_id assignment issue
* RLS policies

Goal:

* Send invitation email
* Assign role correctly
* Add user to organization automatically

---

## Customer Registration Submission

Status: Open

Current Error:

"We could not save this registration. Please try again."

Notes:

Registration pages currently display correctly.

Database currently contains:

* 0 program_enrollments
* 0 program_waitlist records

Registration workflow requires debugging.

---

## Customer Programs Membership Lookup

Status: Investigation

File:

app/(customer)/customer/programs/page.tsx

Possible Causes:

* organization_members.user_id is NULL
* organization_members.user_id does not match auth.users.id
* Membership linked by email only

Required Verification:

organization_members.user_id == auth.users.id

---

## Program Edit Save Logic

Status: Open

File:

lib/programs/program-actions.ts

Missing:

* financial_assistance_enabled
* financial_assistance_open
* financial_assistance_close_date
* financial_assistance_instructions

Needs update in:

UpdateProgramInput

and Supabase update payload.

---

## Future Architectural Improvements

* program_enrollment_sessions table
* Session capacity tracking
* Session-based registration flow
* Eligibility redesign
* Consolidated session management inside Edit Program

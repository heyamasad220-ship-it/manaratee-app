# KNOWN_ISSUES.md

## User Invitations

Status: Fixed (May 2026) — retest in your environment

File: `app/api/organizations/invite-user/route.ts`

Fixes applied:

* Permission check now uses `settings.users.manage` (was incorrectly `users.invite`)
* Auth callback route exchanges invite/OAuth codes: `app/auth/callback/route.ts`
* Existing registered emails: user is added to org + sign-in email sent
* App URL resolves from env or request origin (local dev friendly)
* Invited users use system role `admin` on `organization_members.role` (permissions come from `role_id`)
* **Required:** run `scripts/014_organization_members_invite_support.sql` in Supabase SQL Editor if invite still fails with `organization_members_role_check`

If email still does not arrive, verify in Supabase Dashboard:

* **Authentication → URL Configuration** — add these redirect URLs:
  * `https://manaratee-app.vercel.app/auth/callback`
  * `https://manaratee-app.vercel.app/auth/confirm`
  * `https://manaratee-app.vercel.app/auth/accept` (legacy invite links)
  * `http://localhost:3000/auth/callback` (local dev)
  * `http://localhost:3000/auth/confirm` (local dev)
  * `http://localhost:3000/auth/accept` (local dev)
* **Authentication → Email Templates** — Invite + Reset password enabled
* **Project Settings → API** — `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
* Set `NEXT_PUBLIC_APP_URL=https://manaratee-app.vercel.app` in Vercel env

Invite / reset flow:

1. User clicks email link → `/auth/callback` or `/auth/confirm`
2. Session established → `/auth/set-password` (create password)
3. Redirect to dashboard with org from invite metadata

Required permission to invite: **Manage Users** (`settings.users.manage`) on the inviter's organization role, or system roles `super_admin`, `admin`, `coordinator`, `owner` on `organization_members.role`.

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

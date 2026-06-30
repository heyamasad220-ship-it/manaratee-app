# KNOWN_ISSUES.md

---

## Password Reset (Forgot Password)

Status: Fixed (June 2026) — retest in your environment

Files:

* `app/forgot-password/page.tsx` — sends reset email via `resetPasswordForEmail`
* `app/auth/confirm/route.ts` — exchanges `token_hash` + `type=recovery` (SSR/PKCE-safe)
* `app/auth/set-password/page.tsx` — user chooses new password
* `lib/auth/auth-redirect.ts` — `passwordResetRedirectUrl()` → `/auth/confirm?next=/auth/set-password`
* `supabase/templates/recovery.html` — local dev email template (token_hash link)

**Required for hosted Supabase:** update **Authentication → Email Templates → Reset password** so the link uses `token_hash` (not the default `{{ .ConfirmationURL }}` PKCE callback):

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/set-password">
  Reset password
</a>
```

Without this template change, reset links redirect through `/auth/callback` with a PKCE `code` that fails when the email is opened on a different device or browser than the one that requested the reset.

Flow:

1. User submits email on `/forgot-password`
2. Email link → `/auth/confirm?token_hash=…&type=recovery&next=/auth/set-password`
3. Server verifies OTP and sets session cookies
4. User sets new password on `/auth/set-password` → redirected by role

Also verify redirect URLs include `/auth/confirm` (see User Invitations section below).

---

## User Invitations

Status: Fixed (May 2026) — retest in your environment

File: `app/api/organizations/invite-user/route.ts`

Fixes applied:

* Permission check now uses `settings.users.manage` (was incorrectly `users.invite`)
* Auth callback route exchanges invite/OAuth codes: `app/auth/callback/route.ts`
* Existing registered emails: user is added to org + sign-in email sent
* App URL defaults to `https://app.manaratee.com` in production (see `lib/app/get-app-base-url.ts`)
* Invited users use system role `admin` on `organization_members.role` (permissions come from `role_id`)
* **Required:** run `scripts/014_organization_members_invite_support.sql` in Supabase SQL Editor if invite still fails with `organization_members_role_check`

If email still does not arrive, verify in Supabase Dashboard:

* **Authentication → URL Configuration** — Site URL: `https://app.manaratee.com`
* **Authentication → URL Configuration** — add these redirect URLs:
  * `https://app.manaratee.com/auth/callback`
  * `https://app.manaratee.com/auth/confirm`
  * `https://app.manaratee.com/auth/accept`
  * `http://localhost:3000/auth/callback` (local dev)
  * `http://localhost:3000/auth/confirm` (local dev)
  * `http://localhost:3000/auth/accept` (local dev)
* **Authentication → Email Templates** — Invite + Reset password enabled
* **Project Settings → API** — `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
* Set `NEXT_PUBLIC_APP_URL=https://app.manaratee.com` in Vercel env (recommended; code defaults to this in production)

Invite / reset flow:

1. User clicks email link → `/auth/callback` or `/auth/confirm`
2. Session established → `/auth/set-password` (create password)
3. Redirect to dashboard with org from invite metadata

Customer self-join (no staff invite):

1. Admin shares **Settings → Users → Customer join link** (`https://app.manaratee.com/join/{org-slug}`) or the **Donor signup and give** link (`…/join/{org-slug}?next=/customer/donation%3Fgive%3Done-time`)
2. User creates an account or signs in on that page
3. App links them to the org (viewer membership + contact record) and opens the customer portal (dashboard, or donations page when using the donor link)

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

Status: **Mostly resolved** (June 2026)

Current path:

* `lib/programs/save-edit-program.ts` — edit form save wrapper
* `lib/programs/program-actions.ts` — `updateProgram` includes financial assistance, visibility, waitlist, min/max age

Remaining:

* Run migration `scripts/026_program_min_max_age.sql` if ages do not persist
* Verify production deploy includes latest edit form + `saveEditProgram`

See [programs-staff-setup-ui.md](./programs-staff-setup-ui.md).

---

## Future Architectural Improvements

* program_enrollment_sessions table
* Session capacity tracking
* Session-based registration flow
* ~~Consolidated session management inside Edit Program~~ — **Done** (Edit → Sessions tab)

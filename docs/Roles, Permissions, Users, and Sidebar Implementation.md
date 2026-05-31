# Roles, Permissions, Users, and Sidebar Implementation

## Overview

This session focused on replacing the original hardcoded role system with a scalable multi-tenant SaaS permissions architecture.

The system now supports:

* Custom organization roles
* Role-based permissions
* Server-side page protection
* Permission-aware sidebar navigation
* Subscription-aware module visibility
* User role assignment through the UI

---

# Architecture Decisions

## Platform Owner

The `owner` role is reserved for the platform owner only.

Purpose:

* SaaS owner access
* Cross-organization administration
* Platform management

The `owner` role is NOT used as an organization role.

---

## Organization Roles

Custom organization roles are stored in:

```sql
organization_roles
```

Examples:

* Super Admin
* Admin
* Teacher
* Volunteer
* Accountant

Organizations can create, edit, and delete their own roles.

---

## Organization Members

Two role fields now exist:

### System Role

```sql
organization_members.role
```

Used for:

* Platform-level access
* Existing RLS compatibility
* Internal security checks

### Organization Role

```sql
organization_members.role_id
```

Used for:

* Visible user role
* Custom permissions
* Organization role assignment

This is now the primary role system.

---

# Database Changes

## Created organization_roles

Purpose:

* Store custom organization roles

Fields:

* id
* organization_id
* name
* description
* is_system_role
* created_at
* updated_at

---

## Added role_id to organization_members

Purpose:

* Connect users to custom organization roles

Relationship:

```txt
organization_members.role_id
→ organization_roles.id
```

---

## Created role_permissions

Purpose:

* Store permissions per role

Fields:

* organization_id
* role_id
* permission_key
* enabled

Example permissions:

```txt
settings.users.view
settings.users.manage

settings.roles.view
settings.roles.manage

applications.view
applications.manage

programs.view
programs.manage

donations.view
donations.manage

reports.view
```

---

# Roles & Permissions Page

The previous page used mock data.

The page was rebuilt to use Supabase.

Features:

* Add Role
* Edit Role
* Delete Role
* User counts
* Real organization roles
* Permission matrix

Permissions can now be managed directly from the UI using checkboxes.

Changes save directly to:

```sql
role_permissions
```

---

# Users Page

The Users page was migrated away from:

```sql
profiles.role
```

and now uses:

```sql
organization_members.role_id
```

The page now:

* Loads users from organization_members
* Displays role names from organization_roles
* Supports role assignment
* Supports role changes
* Uses custom organization roles

---

## User Display

Users now display:

```txt
First Name + Last Name
```

using:

```sql
profiles.first_name
profiles.last_name
```

Fallback:

```txt
email address
```

if names are missing.

---

# Permission System

Created:

```txt
lib/permissions/permissions.ts
```

Includes:

### hasPermission()

Checks whether a user has a permission.

### requirePermission()

Protects pages and redirects unauthorized users.

---

# Unauthorized Page

Created:

```txt
/unauthorized
```

Used when a user attempts to access a page without permission.

---

# Server-Side Page Protection

Protected pages include:

* Users
* Roles & Permissions
* Applications

Example:

```ts
await requirePermission(
  PERMISSIONS.SETTINGS_USERS_VIEW
)
```

This prevents direct URL access.

---

# Sidebar System

The application already used:

```sql
my_sidebar_modules
```

to hide modules based on subscriptions.

This behavior was preserved.

---

## New Sidebar Permission Filtering

Sidebar now uses TWO filters:

### 1. Subscription Filter

Module must exist in:

```sql
my_sidebar_modules
```

### 2. Permission Filter

User role must have the required permission.

Example:

```txt
organization subscribed to Programs
AND
role has programs.view
```

Only then is the Programs module displayed.

---

# Permission-Aware Navigation

Added:

```txt
modulePermissionMap
```

Examples:

```txt
programs → programs.view
donations → donations.view
applications → applications.view
```

Submenu items also support permission keys.

Examples:

```txt
programs.manage
donations.manage
reports.view
```

---

# Current System Status

Completed:

* Multi-tenant organizations
* Custom organization roles
* Role assignment
* Permission matrix
* Server-side page protection
* Unauthorized page
* Permission-aware sidebar
* Subscription-aware modules
* User role management

---

# Current Issue To Work On

User invitations are not working.

The next task is debugging:

```txt
app/api/organizations/invite-user/route.ts
```

Potential causes:

* Supabase invite flow
* Email provider configuration
* Missing redirect URL
* Missing environment variables
* role_id not being saved
* organization_members insert failure
* RLS policy issue

Goal:

* Send invitation email successfully
* Assign organization role correctly
* Add invited user to organization automatically
* Complete onboarding flow

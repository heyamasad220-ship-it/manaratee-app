I’m building a multi-tenant SaaS web app using Next.js + Supabase. I am NOT a developer, so I need beginner-friendly step-by-step instructions, exact SQL queries, and full replacement files/pages instead of abstract explanations.

Current architecture:

* multi-tenant organizations
* custom organization roles
* role_permissions system
* server-side permission protection
* permission-aware sidebar
* subscription-aware modules
* organization_members.role = hidden system/platform role
* organization_members.role_id = visible organization role
* organization_roles table for custom roles
* role_permissions table for granular permissions

Important:

* owner role is reserved for platform owner only
* organization roles are custom roles like Super Admin, Admin, etc.
* sidebar already filters modules by subscription using my_sidebar_modules
* permissions now additionally filter sidebar visibility

Completed systems:

* Users page rebuilt using organization_members + organization_roles
* Roles & Permissions page rebuilt
* permission matrix with checkboxes
* protected routes/pages
* unauthorized page
* sidebar permission filtering

Tech stack:

* Next.js App Router
* TypeScript
* Supabase
* Tailwind
* shadcn/ui

Preferred help style:

* exact code replacements
* full files
* debugging help
* exact SQL
* minimal abstract explanations

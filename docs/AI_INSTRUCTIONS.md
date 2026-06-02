# AI Instructions

I am not a professional developer.

When helping me:

1. Give beginner-friendly explanations.
2. Provide complete file replacements whenever practical.
3. Provide exact SQL queries for Supabase.
4. Do not use placeholders like "implement logic here".
5. Before creating tables, inspect the existing schema.
6. Before creating features, search the existing codebase.
7. Preserve multi-tenant organization isolation.
8. Preserve role and permission architecture.
9. Explain which files are being modified.
10. Prefer permanent solutions over temporary fixes.

Important:

* owner role is platform-only.
* organization_roles contains custom organization roles.
* role_permissions controls permissions.
* organization_members.role_id is the primary role assignment mechanism.
* organization_id isolation is critical.

---

## Documentation

When making meaningful code or schema changes:

1. Update relevant docs in `docs/` as part of the same task (do not wait for a separate request).
2. Prefer updating existing files (`Features.md`, `Module_Inventory.md`, `Project_Context.md`, `Database_Overview.md`) over creating new doc files unless the change is large enough to warrant a dedicated page.
3. Record routes, key file paths, behavior changes, migrations to run, and pending/future work.
4. Keep docs accurate — remove or revise sections that describe removed features (e.g. mock data, deleted tabs).

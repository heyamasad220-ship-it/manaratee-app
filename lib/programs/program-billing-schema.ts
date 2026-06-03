const BILLING_SCHEMA_MARKERS = [
  "program_offering_billing_periods",
  "program_billing_overrides",
  "sync_offering_billing_periods",
  "waive_charge_schedule_item",
  "void_program_charge_line",
  "adjust_program_charge_line",
  "add_program_charge_line",
  "staff_ensure_enrollment_charge",
  "program_charge_schedule",
  "program_charges",
] as const

export function isBillingSchemaMissingError(message: string | undefined | null) {
  if (!message) return false

  const normalized = message.toLowerCase()

  return (
    normalized.includes("could not find the table") ||
    normalized.includes("could not find the function") ||
    normalized.includes("relation") && normalized.includes("does not exist") ||
    BILLING_SCHEMA_MARKERS.some((marker) => normalized.includes(marker))
  )
}

export const BILLING_MIGRATION_SCRIPTS = [
  "scripts/020_program_charge_ledger_foundation.sql",
  "scripts/021_program_billing_schedule_and_overrides.sql",
  "scripts/022_program_charge_line_admin.sql",
  "scripts/023_register_for_program_charge_ledger.sql",
] as const

export const BILLING_MIGRATION_MESSAGE =
  "Phase 2B billing tables are not in your database yet. Run the SQL migrations in Supabase SQL Editor (020 first, then 021), then reload this page."

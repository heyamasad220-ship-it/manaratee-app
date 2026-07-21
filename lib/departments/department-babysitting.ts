"use server"

import {
  defaultAcademicPeriodKeys,
  mergePeriodKeys,
  roundMoney,
  type DepartmentPeriodColumn,
} from "@/lib/departments/department-period-helpers"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type BabysittingIncomeCell = {
  periodKey: string
  amount: number
  entryId: string | null
}

export type BabysitterPayRow = {
  key: string
  contactId: string | null
  displayName: string
  months: Record<
    string,
    { periodKey: string; amount: number; hoursWorked: number | null; entryId: string | null }
  >
}

export type DepartmentBabysittingMatrix = {
  months: DepartmentPeriodColumn[]
  incomeByMonth: Record<string, BabysittingIncomeCell>
  babysitters: BabysitterPayRow[]
  migrationRequired: boolean
}

function isMissingTableError(message: string | undefined) {
  if (!message) return false
  return (
    /relation ["'].*["'] does not exist/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /\b42P01\b/.test(message)
  )
}

async function requireOrg() {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return { ok: false as const, error: "No organization selected." }
  const supabase = await createClient()
  return { ok: true as const, organizationId, supabase }
}

export async function fetchDepartmentBabysittingMatrix(
  departmentId: string
): Promise<DepartmentBabysittingMatrix> {
  const allowed = await hasPermission(PERMISSIONS.STAFF_VIEW)
  if (!allowed) {
    throw new Error("You do not have permission to view babysitting.")
  }

  const access = await requireOrg()
  if (!access.ok) {
    return {
      months: [],
      incomeByMonth: {},
      babysitters: [],
      migrationRequired: false,
    }
  }

  let migrationRequired = false

  const [incomeResult, payResult] = await Promise.all([
    access.supabase
      .from("department_babysitting_income_entries")
      .select("id, period_key, amount")
      .eq("organization_id", access.organizationId)
      .eq("department_id", departmentId),
    access.supabase
      .from("department_babysitting_pay_entries")
      .select("id, contact_id, display_name, period_key, hours_worked, amount")
      .eq("organization_id", access.organizationId)
      .eq("department_id", departmentId)
      .order("display_name", { ascending: true }),
  ])

  if (incomeResult.error && isMissingTableError(incomeResult.error.message)) {
    migrationRequired = true
  } else if (incomeResult.error) {
    throw new Error(incomeResult.error.message)
  }

  if (payResult.error && isMissingTableError(payResult.error.message)) {
    migrationRequired = true
  } else if (payResult.error) {
    throw new Error(payResult.error.message)
  }

  const periodKeys = [
    ...(incomeResult.data || []).map((row) => row.period_key as string),
    ...(payResult.data || []).map((row) => row.period_key as string),
  ]
  const months = mergePeriodKeys(periodKeys, defaultAcademicPeriodKeys())

  const incomeByMonth: Record<string, BabysittingIncomeCell> = {}
  for (const month of months) {
    incomeByMonth[month.periodKey] = {
      periodKey: month.periodKey,
      amount: 0,
      entryId: null,
    }
  }
  for (const row of incomeResult.data || []) {
    incomeByMonth[row.period_key as string] = {
      periodKey: row.period_key as string,
      amount: roundMoney(Number(row.amount || 0)),
      entryId: row.id as string,
    }
  }

  const byPerson = new Map<string, BabysitterPayRow>()
  for (const row of payResult.data || []) {
    const contactId = (row.contact_id as string | null) ?? null
    const displayName = ((row.display_name as string) || "Babysitter").trim()
    const key = contactId || `name:${displayName.toLowerCase()}`
    let person = byPerson.get(key)
    if (!person) {
      person = {
        key,
        contactId,
        displayName,
        months: {},
      }
      for (const month of months) {
        person.months[month.periodKey] = {
          periodKey: month.periodKey,
          amount: 0,
          hoursWorked: null,
          entryId: null,
        }
      }
      byPerson.set(key, person)
    }
    person.months[row.period_key as string] = {
      periodKey: row.period_key as string,
      amount: roundMoney(Number(row.amount || 0)),
      hoursWorked: row.hours_worked == null ? null : Number(row.hours_worked),
      entryId: row.id as string,
    }
  }

  return {
    months,
    incomeByMonth,
    babysitters: [...byPerson.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    ),
    migrationRequired,
  }
}

export async function fetchDepartmentBabysittingAction(departmentId: string) {
  try {
    const matrix = await fetchDepartmentBabysittingMatrix(departmentId)
    return { success: true as const, matrix }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load babysitting.",
    }
  }
}

export async function upsertBabysittingIncomeAction(input: {
  departmentId: string
  periodKey: string
  amount: number
}) {
  const allowed = await hasPermission(PERMISSIONS.STAFF_MANAGE)
  if (!allowed) {
    return { success: false as const, error: "You do not have permission to edit babysitting." }
  }
  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }
  if (!/^\d{4}-\d{2}$/.test(input.periodKey)) {
    return { success: false as const, error: "Invalid month." }
  }

  const { error } = await access.supabase.from("department_babysitting_income_entries").upsert(
    {
      organization_id: access.organizationId,
      department_id: input.departmentId,
      period_key: input.periodKey,
      amount: roundMoney(Math.max(0, Number(input.amount) || 0)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,department_id,period_key" }
  )

  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        success: false as const,
        error: "Run scripts/170_department_operating_finance.sql in Supabase first.",
      }
    }
    return { success: false as const, error: error.message }
  }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const }
}

export async function upsertBabysitterPayAction(input: {
  departmentId: string
  periodKey: string
  displayName: string
  contactId?: string | null
  amount: number
  hoursWorked?: number | null
}) {
  const allowed = await hasPermission(PERMISSIONS.STAFF_MANAGE)
  if (!allowed) {
    return { success: false as const, error: "You do not have permission to edit babysitting." }
  }
  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }
  if (!/^\d{4}-\d{2}$/.test(input.periodKey)) {
    return { success: false as const, error: "Invalid month." }
  }

  const displayName = input.displayName.trim()
  if (!displayName) {
    return { success: false as const, error: "Babysitter name is required." }
  }

  const amount = roundMoney(Math.max(0, Number(input.amount) || 0))
  const hoursWorked =
    input.hoursWorked == null || Number.isNaN(Number(input.hoursWorked))
      ? null
      : Number(input.hoursWorked)

  // Find existing row for this person + month
  let existingQuery = access.supabase
    .from("department_babysitting_pay_entries")
    .select("id")
    .eq("organization_id", access.organizationId)
    .eq("department_id", input.departmentId)
    .eq("period_key", input.periodKey)

  if (input.contactId) {
    existingQuery = existingQuery.eq("contact_id", input.contactId)
  } else {
    existingQuery = existingQuery.is("contact_id", null).ilike("display_name", displayName)
  }

  const { data: existing } = await existingQuery.maybeSingle()

  if (existing?.id) {
    const { error } = await access.supabase
      .from("department_babysitting_pay_entries")
      .update({
        display_name: displayName,
        amount,
        hours_worked: hoursWorked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("organization_id", access.organizationId)

    if (error) return { success: false as const, error: error.message }
  } else {
    const { error } = await access.supabase.from("department_babysitting_pay_entries").insert({
      organization_id: access.organizationId,
      department_id: input.departmentId,
      contact_id: input.contactId || null,
      display_name: displayName,
      period_key: input.periodKey,
      amount,
      hours_worked: hoursWorked,
    })

    if (error) {
      if (isMissingTableError(error.message)) {
        return {
          success: false as const,
          error: "Run scripts/170_department_operating_finance.sql in Supabase first.",
        }
      }
      return { success: false as const, error: error.message }
    }
  }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const }
}

export async function addBabysitterToDepartmentAction(input: {
  departmentId: string
  displayName: string
  contactId?: string | null
}) {
  const firstPeriod = defaultAcademicPeriodKeys()[0]
  return upsertBabysitterPayAction({
    departmentId: input.departmentId,
    periodKey: firstPeriod,
    displayName: input.displayName,
    contactId: input.contactId,
    amount: 0,
    hoursWorked: null,
  })
}

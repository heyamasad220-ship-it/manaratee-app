"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import {
  isExpenseCategory,
  type EventExpense,
  type EventExpenseActionResult,
} from "@/lib/events/event-expense-types"

function revalidateExpensePaths(eventId: string) {
  revalidatePath(`/event-management/${eventId}`)
  revalidatePath("/event-management")
}

export async function listEventExpenses(
  eventId: string
): Promise<EventExpense[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !eventId) return []

  const { data, error } = await supabase
    .from("event_expenses")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", eventId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    return []
  }

  return (data || []) as EventExpense[]
}

export async function createEventExpense(input: {
  eventId: string
  expenseDate: string
  category: string
  amountDollars: number
  payee?: string | null
  description?: string | null
  isPaid?: boolean
  paymentMethod?: string | null
  reference?: string | null
  notes?: string | null
  currency?: string
}): Promise<EventExpenseActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to manage expenses." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const category = input.category.trim() || "Other"
    if (!isExpenseCategory(category)) {
      return { success: false, error: "Invalid expense category." }
    }

    const amountCents = Math.round(Number(input.amountDollars) * 100)
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      return { success: false, error: "Enter a valid amount." }
    }

    const expenseDate = input.expenseDate.trim()
    if (!expenseDate) {
      return { success: false, error: "Expense date is required." }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("event_expenses")
      .insert({
        organization_id: organizationId,
        internal_event_id: input.eventId,
        expense_date: expenseDate,
        category,
        payee: input.payee?.trim() || null,
        description: input.description?.trim() || null,
        amount_cents: amountCents,
        currency: input.currency?.trim() || "USD",
        is_paid: input.isPaid === true,
        payment_method: input.paymentMethod?.trim() || null,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        created_by: user?.id ?? null,
      })
      .select("*")
      .single()

    if (error) {
      console.error(error)
      const message = error.message || ""
      if (message.includes("event_expenses") || message.includes("schema cache")) {
        return {
          success: false,
          error:
            "Expenses table is missing. Run scripts/252_event_workspace_redesign.sql in Supabase, then try again.",
        }
      }
      return { success: false, error: "Failed to create expense." }
    }

    revalidateExpensePaths(input.eventId)
    return { success: true, expense: data as EventExpense }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create expense.",
    }
  }
}

export async function deleteEventExpense(input: {
  id: string
  eventId: string
}): Promise<EventExpenseActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to manage expenses." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const { error } = await supabase
      .from("event_expenses")
      .delete()
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .eq("internal_event_id", input.eventId)

    if (error) {
      console.error(error)
      return { success: false, error: "Failed to delete expense." }
    }

    revalidateExpensePaths(input.eventId)
    return { success: true }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete expense.",
    }
  }
}

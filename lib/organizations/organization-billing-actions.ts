"use server"

import { revalidatePath } from "next/cache"

import { getOrganizationSubscriptionSummary } from "@/lib/organizations/organization-subscription-summary"
import { requireOrganizationSuperAdmin } from "@/lib/organizations/organization-billing-access"

export type OrganizationPaymentMethodRow = {
  id: string
  cardBrand: string | null
  last4: string
  expMonth: number | null
  expYear: number | null
  cardholderName: string | null
  isDefault: boolean
  createdAt: string
}

export type OrganizationBillingInvoiceRow = {
  id: string
  amount: number
  currency: string
  status: string
  description: string | null
  periodStart: string | null
  periodEnd: string | null
  paidAt: string | null
  createdAt: string
}

function mapPaymentMethod(row: Record<string, unknown>): OrganizationPaymentMethodRow {
  return {
    id: row.id as string,
    cardBrand: (row.card_brand as string | null) ?? null,
    last4: row.last4 as string,
    expMonth: row.exp_month == null ? null : Number(row.exp_month),
    expYear: row.exp_year == null ? null : Number(row.exp_year),
    cardholderName: (row.cardholder_name as string | null) ?? null,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at as string,
  }
}

function mapInvoice(row: Record<string, unknown>): OrganizationBillingInvoiceRow {
  return {
    id: row.id as string,
    amount: Number(row.amount || 0),
    currency: (row.currency as string) || "USD",
    status: (row.status as string) || "pending",
    description: (row.description as string | null) ?? null,
    periodStart: (row.period_start as string | null) ?? null,
    periodEnd: (row.period_end as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

export async function getOrganizationBillingProfileAction() {
  const access = await requireOrganizationSuperAdmin()
  const { supabase, organizationId } = access

  try {
    const [summary, paymentMethodsResult, invoicesResult, orgResult] = await Promise.all([
      getOrganizationSubscriptionSummary(organizationId),
      supabase
        .from("organization_payment_methods")
        .select(
          "id, card_brand, last4, exp_month, exp_year, cardholder_name, is_default, created_at"
        )
        .eq("organization_id", organizationId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_billing_invoices")
        .select(
          "id, amount, currency, status, description, period_start, period_end, paid_at, created_at"
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("organizations")
        .select("billing_email")
        .eq("id", organizationId)
        .maybeSingle(),
    ])

    if (paymentMethodsResult.error) {
      return { success: false as const, error: paymentMethodsResult.error.message }
    }
    if (invoicesResult.error) {
      return { success: false as const, error: invoicesResult.error.message }
    }

    return {
      success: true as const,
      summary,
      billingEmail: (orgResult.data?.billing_email as string | null) ?? null,
      paymentMethods: (paymentMethodsResult.data || []).map(mapPaymentMethod),
      invoices: (invoicesResult.data || []).map(mapInvoice),
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function addOrganizationPaymentMethodAction(input: {
  cardBrand: string
  last4: string
  expMonth: number
  expYear: number
  cardholderName?: string
  setAsDefault?: boolean
}) {
  const access = await requireOrganizationSuperAdmin()
  const { supabase, organizationId, userId } = access

  const last4 = input.last4.replace(/\D/g, "").slice(-4)
  if (last4.length !== 4) {
    return { success: false as const, error: "Enter the last 4 digits of the card." }
  }

  const expMonth = Number(input.expMonth)
  const expYear = Number(input.expYear)
  if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) {
    return { success: false as const, error: "Enter a valid expiration month." }
  }
  if (!Number.isInteger(expYear) || expYear < new Date().getFullYear()) {
    return { success: false as const, error: "Enter a valid expiration year." }
  }

  const setAsDefault = input.setAsDefault !== false

  if (setAsDefault) {
    const { error: clearError } = await supabase
      .from("organization_payment_methods")
      .update({ is_default: false })
      .eq("organization_id", organizationId)

    if (clearError) {
      return { success: false as const, error: clearError.message }
    }
  }

  const { data, error } = await supabase
    .from("organization_payment_methods")
    .insert({
      organization_id: organizationId,
      card_brand: input.cardBrand.trim() || null,
      last4,
      exp_month: expMonth,
      exp_year: expYear,
      cardholder_name: input.cardholderName?.trim() || null,
      is_default: setAsDefault,
      created_by: userId,
    })
    .select(
      "id, card_brand, last4, exp_month, exp_year, cardholder_name, is_default, created_at"
    )
    .single()

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidatePath("/billing")
  return { success: true as const, paymentMethod: mapPaymentMethod(data) }
}

export async function setDefaultOrganizationPaymentMethodAction(paymentMethodId: string) {
  const access = await requireOrganizationSuperAdmin()
  const { supabase, organizationId } = access

  const { error: clearError } = await supabase
    .from("organization_payment_methods")
    .update({ is_default: false })
    .eq("organization_id", organizationId)

  if (clearError) {
    return { success: false as const, error: clearError.message }
  }

  const { error } = await supabase
    .from("organization_payment_methods")
    .update({ is_default: true })
    .eq("organization_id", organizationId)
    .eq("id", paymentMethodId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidatePath("/billing")
  return { success: true as const }
}

export async function removeOrganizationPaymentMethodAction(paymentMethodId: string) {
  const access = await requireOrganizationSuperAdmin()
  const { supabase, organizationId } = access

  const { error } = await supabase
    .from("organization_payment_methods")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", paymentMethodId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidatePath("/billing")
  return { success: true as const }
}

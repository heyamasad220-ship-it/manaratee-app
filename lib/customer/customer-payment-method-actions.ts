"use server"

import { revalidatePath } from "next/cache"

import { getCustomerPortalClients } from "@/lib/auth/customer-portal-session"
import type { ContactPaymentMethodRow } from "@/lib/contacts/contact-payment-method-actions"
import {
  extractCardLast4,
  parseCardExpiration,
  validateCardNumber,
  validateSecurityCode,
} from "@/lib/contacts/contact-payment-method-validation"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

function mapPaymentMethod(row: Record<string, unknown>): ContactPaymentMethodRow {
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

async function getAuthenticatedCustomerContact(contactId: string) {
  const clients = await getCustomerPortalClients()

  if (!clients) {
    throw new Error("You must be signed in to manage payment methods.")
  }

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    throw new Error("No active organization")
  }

  const organizationId = activeOrganization.organization_id

  const { data: contact, error } = await clients.dataClient
    .from("contacts")
    .select("id, organization_id")
    .eq("auth_user_id", clients.effectiveUserId)
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (error || !contact) {
    throw new Error("Contact not found")
  }

  return {
    supabase: clients.actionClient,
    organizationId,
    contactId: contact.id as string,
    userId: clients.effectiveUserId,
  }
}

export async function addCustomerContactPaymentMethodAction(input: {
  contactId: string
  cardBrand: string
  cardNumber: string
  securityCode: string
  expirationDate: string
  cardholderName?: string
  setAsDefault?: boolean
}) {
  try {
    const { supabase, organizationId, contactId, userId } =
      await getAuthenticatedCustomerContact(input.contactId)

    const cardNumberError = validateCardNumber(input.cardNumber)
    if (cardNumberError) {
      return { success: false as const, error: cardNumberError }
    }

    const last4 = extractCardLast4(input.cardNumber)
    if (last4.length !== 4) {
      return { success: false as const, error: "Enter a valid card number." }
    }

    const securityCodeError = validateSecurityCode(input.securityCode, input.cardBrand)
    if (securityCodeError) {
      return { success: false as const, error: securityCodeError }
    }

    const parsedExpiration = parseCardExpiration(input.expirationDate)
    if (!parsedExpiration.ok) {
      return { success: false as const, error: parsedExpiration.error }
    }

    const { expMonth, expYear } = parsedExpiration
    const setAsDefault = input.setAsDefault !== false

    if (setAsDefault) {
      const { error: clearError } = await supabase
        .from("contact_payment_methods")
        .update({ is_default: false })
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)

      if (clearError) {
        return { success: false as const, error: clearError.message }
      }
    }

    const { data, error } = await supabase
      .from("contact_payment_methods")
      .insert({
        organization_id: organizationId,
        contact_id: contactId,
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

    revalidatePath("/customer/profile")
    revalidatePath("/customer/donation")
    return { success: true as const, paymentMethod: mapPaymentMethod(data) }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function setDefaultCustomerContactPaymentMethodAction(input: {
  contactId: string
  paymentMethodId: string
}) {
  try {
    const { supabase, organizationId, contactId } =
      await getAuthenticatedCustomerContact(input.contactId)

    const { error: clearError } = await supabase
      .from("contact_payment_methods")
      .update({ is_default: false })
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)

    if (clearError) {
      return { success: false as const, error: clearError.message }
    }

    const { error } = await supabase
      .from("contact_payment_methods")
      .update({ is_default: true })
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .eq("id", input.paymentMethodId)

    if (error) {
      return { success: false as const, error: error.message }
    }

    revalidatePath("/customer/profile")
    revalidatePath("/customer/donation")
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function removeCustomerContactPaymentMethodAction(input: {
  contactId: string
  paymentMethodId: string
}) {
  try {
    const { supabase, organizationId, contactId } =
      await getAuthenticatedCustomerContact(input.contactId)

    const { error } = await supabase
      .from("contact_payment_methods")
      .delete()
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .eq("id", input.paymentMethodId)

    if (error) {
      return { success: false as const, error: error.message }
    }

    revalidatePath("/customer/profile")
    revalidatePath("/customer/donation")
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

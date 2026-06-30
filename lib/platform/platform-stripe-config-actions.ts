"use server"

import Stripe from "stripe"

import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"
import { getAppBaseUrl, isStripeConfigured } from "@/lib/stripe/stripe-server"

export async function getPlatformStripeConfigStatusAction() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return { success: false as const, error: auth.error }
  }

  let webhookUrl = "/api/webhooks/stripe/donations"
  let appUrlConfigured = false

  try {
    webhookUrl = `${getAppBaseUrl()}/api/webhooks/stripe/donations`
    appUrlConfigured = true
  } catch {
    appUrlConfigured = false
  }

  return {
    success: true as const,
    platformStripeConfigured: isStripeConfigured(),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    appUrlConfigured,
    webhookUrl,
  }
}

export async function testPlatformStripeConnectionAction() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return { success: false as const, error: auth.error }
  }

  if (!isStripeConfigured()) {
    return {
      success: false as const,
      error: "STRIPE_SECRET_KEY is not set in this environment (Vercel).",
    }
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), { typescript: true })
    const account = await stripe.accounts.retrieve()
    return {
      success: true as const,
      accountId: account.id,
      chargesEnabled: Boolean(account.charges_enabled),
    }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? `Stripe connection failed: ${error.message}`
          : "Stripe connection failed.",
    }
  }
}

export async function savePlatformStripeConfigAction(input: {
  publishableKey: string
  secretKey: string
  webhookSecret: string
}) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return { success: false as const, error: auth.error }
  }

  const publishableKey = input.publishableKey.trim()
  const secretKey = input.secretKey.trim()
  const webhookSecret = input.webhookSecret.trim()
  const errors: string[] = []

  if (!publishableKey) {
    errors.push("Publishable key is required.")
  } else if (!publishableKey.startsWith("pk_live_") && !publishableKey.startsWith("pk_test_")) {
    errors.push("Publishable key must start with pk_live_ or pk_test_.")
  }

  if (!secretKey) {
    errors.push("Secret key is required.")
  } else if (!secretKey.startsWith("sk_live_") && !secretKey.startsWith("sk_test_")) {
    errors.push("Secret key must start with sk_live_ or sk_test_.")
  }

  if (!webhookSecret) {
    errors.push("Webhook secret is required.")
  } else if (!webhookSecret.startsWith("whsec_")) {
    errors.push("Webhook secret must start with whsec_.")
  }

  if (publishableKey && secretKey) {
    const publishableLive = publishableKey.startsWith("pk_live_")
    const secretLive = secretKey.startsWith("sk_live_")
    if (publishableLive !== secretLive) {
      errors.push("Publishable and secret keys must both be live or both be test.")
    }
  }

  if (errors.length > 0) {
    return { success: false as const, error: errors.join(" ") }
  }

  try {
    const stripe = new Stripe(secretKey, { typescript: true })
    await stripe.accounts.retrieve()
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? `Stripe rejected the secret key: ${error.message}`
          : "Stripe secret key validation failed.",
    }
  }

  const envConfigured = isStripeConfigured()

  return {
    success: true as const,
    message: envConfigured
      ? "Stripe keys validated. Ensure Vercel environment variables match these values."
      : "Stripe keys validated. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to Vercel, then redeploy.",
  }
}

import Stripe from "stripe"

let stripeClient: Stripe | null = null

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

export function getStripeServerClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      typescript: true,
    })
  }

  return stripeClient
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured")
  }
  return secret
}

export function getAppBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!base) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured")
  }
  return base.replace(/\/$/, "")
}

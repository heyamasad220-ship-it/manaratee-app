import { NextResponse } from "next/server"
import Stripe from "stripe"

import { processStripeDonationWebhookEvent } from "@/lib/donations/stripe/checkout"
import { getStripeServerClient, getStripeWebhookSecret, isStripeConfigured } from "@/lib/stripe/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    const stripe = getStripeServerClient()
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret())
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid signature" },
      { status: 400 }
    )
  }

  try {
    const supabase = createServiceRoleClient()
    const result = await processStripeDonationWebhookEvent(supabase, event)
    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    console.error("Stripe donation webhook handler failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handler failed" },
      { status: 500 }
    )
  }
}

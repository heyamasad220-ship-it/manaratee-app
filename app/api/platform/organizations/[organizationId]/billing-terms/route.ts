import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { loadOrganizationSubscription } from "@/lib/billing/organization-subscription-service"
import { computeOrganizationSubscriptionTerms } from "@/lib/organizations/organization-subscription-terms"

async function requirePlatformAdmin() {
  const supabaseUser = await createServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser()

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: platformAdmin, error: adminCheckError } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (adminCheckError) {
    return {
      error: NextResponse.json({ error: adminCheckError.message }, { status: 500 }),
    }
  }

  if (!platformAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { admin }
}

async function loadBilledMonthlyDollars(organizationId: string) {
  const snapshot = await loadOrganizationSubscription(organizationId)
  return (snapshot?.billedMonthlyCents ?? 0) / 100
}

function parseOptionalDate(value: unknown) {
  if (value == null || value === "") return null
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("subscriptionStartDate must be YYYY-MM-DD.")
  }
  return value
}

function parseComplimentaryMonths(value: unknown) {
  const months = Number(value ?? 0)
  if (!Number.isInteger(months) || months < 0 || months > 24) {
    throw new Error("complimentaryMonths must be an integer from 0 to 24.")
  }
  return months
}

function parseFirstYearRate(value: unknown) {
  if (value == null || value === "") return null
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("firstYearSpecialMonthlyRate must be a non-negative number.")
  }
  return rate
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const auth = await requirePlatformAdmin()
  if ("error" in auth && auth.error) return auth.error

  try {
    const { organizationId } = await params
    const { data: org, error } = await auth.admin
      .from("organizations")
      .select("subscription_start_date, complimentary_months, first_year_special_monthly_rate")
      .eq("id", organizationId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 })
    }

    const standardMonthlyRate = await loadBilledMonthlyDollars(organizationId)
    const terms = computeOrganizationSubscriptionTerms(
      {
        subscriptionStartDate: (org.subscription_start_date as string | null) ?? null,
        complimentaryMonths: Number(org.complimentary_months || 0),
        firstYearSpecialMonthlyRate:
          org.first_year_special_monthly_rate == null
            ? null
            : Number(org.first_year_special_monthly_rate),
      },
      standardMonthlyRate
    )

    return NextResponse.json({ terms })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load subscription terms."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const auth = await requirePlatformAdmin()
  if ("error" in auth && auth.error) return auth.error

  try {
    const { organizationId } = await params
    const body = await request.json()

    const subscriptionStartDate = parseOptionalDate(body.subscriptionStartDate)
    const complimentaryMonths = parseComplimentaryMonths(body.complimentaryMonths)
    const firstYearSpecialMonthlyRate = parseFirstYearRate(body.firstYearSpecialMonthlyRate)

    const { data: org, error } = await auth.admin
      .from("organizations")
      .update({
        subscription_start_date: subscriptionStartDate,
        complimentary_months: complimentaryMonths,
        first_year_special_monthly_rate: firstYearSpecialMonthlyRate,
      })
      .eq("id", organizationId)
      .select("subscription_start_date, complimentary_months, first_year_special_monthly_rate")
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 })
    }

    const standardMonthlyRate = await loadBilledMonthlyDollars(organizationId)
    const terms = computeOrganizationSubscriptionTerms(
      {
        subscriptionStartDate: (org.subscription_start_date as string | null) ?? null,
        complimentaryMonths: Number(org.complimentary_months || 0),
        firstYearSpecialMonthlyRate:
          org.first_year_special_monthly_rate == null
            ? null
            : Number(org.first_year_special_monthly_rate),
      },
      standardMonthlyRate
    )

    return NextResponse.json({ success: true, terms })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update subscription terms."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

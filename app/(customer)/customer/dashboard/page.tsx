import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CalendarDays,
  Gift,
  GraduationCap,
  HandCoins,
  User,
} from "lucide-react"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import {
  isCustomerPortalModuleEnabled,
} from "@/lib/customer/customer-portal-modules"
import { loadCustomerPortalEnabledModuleSlugs } from "@/lib/customer/customer-portal-modules-server"
import { buildCustomerOpenDonationCategories } from "@/lib/customer/customer-open-donation-categories"
import { Card, CardContent } from "@/components/ui/card"
import { CustomerDashboardGivingSection } from "@/components/customer/customer-dashboard-giving-section"
import type {
  CustomerDashboardCampaign,
} from "@/components/customer/customer-dashboard-campaigns"
import type {
  CustomerDashboardCategory,
} from "@/components/customer/customer-dashboard-categories"

function formatDashboardCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function CustomerDashboardPage() {
  const { supabase, session } = await getCustomerPortalSupabase()
  const userId = session.effectiveUserId

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  const organizationId = activeOrganization.organization_id

  const enabledModuleSlugs = await loadCustomerPortalEnabledModuleSlugs(organizationId)

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, organization_id")
    .eq("auth_user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const { count: rentalsCount } = isCustomerPortalModuleEnabled(enabledModuleSlugs, "bookings")
    ? await supabase
        .from("venue_rentals")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("customer_user_id", userId)
    : { count: 0 }

  const { count: donationCount } =
    contact?.id && isCustomerPortalModuleEnabled(enabledModuleSlugs, "donations")
      ? await supabase
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("contact_id", contact.id)
      : { count: 0 }

  const { count: programEnrollmentCount } =
    contact?.id && isCustomerPortalModuleEnabled(enabledModuleSlugs, "programs")
      ? await supabase
          .from("program_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("registrant_contact_id", contact.id)
      : { count: 0 }

  const donationsModuleEnabled = isCustomerPortalModuleEnabled(enabledModuleSlugs, "donations")

  let openPledgeCount = 0
  let openPledgeBalance = 0

  if (donationsModuleEnabled && contact?.id) {
    const { data: donorRows } = await supabase
      .from("donors")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contact.id)

    const donorIds = (donorRows || []).map((row) => row.id as string)

    if (donorIds.length > 0) {
      const { data: pledgeRows } = await supabase
        .from("pledge_status_view")
        .select("balance_remaining, calculated_status")
        .eq("organization_id", organizationId)
        .in("donor_id", donorIds)

      for (const row of pledgeRows || []) {
        const status = String(row.calculated_status || "").toLowerCase()
        if (status === "fulfilled" || status === "cancelled") continue

        const balance = Number(row.balance_remaining || 0)
        if (balance <= 0) continue

        openPledgeCount += 1
        openPledgeBalance += balance
      }
    }
  }

  const { data: activeCampaignRows } = donationsModuleEnabled
    ? await supabase
        .from("campaigns")
        .select("id, name, description")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("name", { ascending: true })
    : { data: [] }

  const activeCampaigns: CustomerDashboardCampaign[] = (activeCampaignRows || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    flyerUrl: null,
  }))

  let activeCategories: CustomerDashboardCategory[] = []

  if (donationsModuleEnabled) {
    const [{ data: categoryRows }, { data: subcategoryRows }] = await Promise.all([
      supabase
        .from("donation_categories")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true }),
      supabase
        .from("donation_subcategories")
        .select("id, name, category_id, is_active")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true }),
    ])

    activeCategories = buildCustomerOpenDonationCategories(
      (categoryRows || []) as Array<{ id: string; name: string }>,
      (subcategoryRows || []) as Array<{
        id: string
        name: string
        category_id: string
        is_active?: boolean | null
      }>
    ).map((category) => ({
      id: category.id,
      name: category.name,
    }))
  }

  type OverviewCardTheme = {
    border: string
    valueClass: string
    iconWrap: string
    icon: string
  }

  const cardThemes: Record<string, OverviewCardTheme> = {
    profile: {
      border: "border-l-4 border-l-primary",
      valueClass: "text-foreground",
      iconWrap: "bg-primary/10",
      icon: "text-primary",
    },
    donations: {
      border: "border-l-4 border-l-emerald-500",
      valueClass: "text-emerald-600",
      iconWrap: "bg-emerald-100",
      icon: "text-emerald-600",
    },
    pledges: {
      border: "border-l-4 border-l-amber-500",
      valueClass: "text-amber-600",
      iconWrap: "bg-amber-100",
      icon: "text-amber-600",
    },
    bookings: {
      border: "border-l-4 border-l-sky-500",
      valueClass: "text-foreground",
      iconWrap: "bg-sky-100",
      icon: "text-sky-600",
    },
    programs: {
      border: "border-l-4 border-l-violet-500",
      valueClass: "text-violet-600",
      iconWrap: "bg-violet-100",
      icon: "text-violet-600",
    },
  }

  const overviewCards = [
    {
      key: "profile",
      title: "Profile",
      value: "View",
      description: "Manage your account information",
      href: "/customer/profile",
      icon: User,
    },
    isCustomerPortalModuleEnabled(enabledModuleSlugs, "bookings")
      ? {
          key: "bookings",
          title: "Venue Rentals",
          value: rentalsCount || 0,
          description: "Venue requests and reservations",
          href: "/customer/rentals",
          icon: CalendarDays,
        }
      : null,
    isCustomerPortalModuleEnabled(enabledModuleSlugs, "donations")
      ? {
          key: "donations",
          title: "Donations",
          value: donationCount || 0,
          description: "Giving history and contributions",
          href: "/customer/donation",
          icon: Gift,
        }
      : null,
    isCustomerPortalModuleEnabled(enabledModuleSlugs, "donations")
      ? {
          key: "pledges",
          title: "Pledges",
          value: openPledgeCount,
          description: `${formatDashboardCurrency(openPledgeBalance)} remaining balance`,
          href: "/customer/donation",
          icon: HandCoins,
        }
      : null,
    isCustomerPortalModuleEnabled(enabledModuleSlugs, "programs")
      ? {
          key: "programs",
          title: "Programs",
          value: programEnrollmentCount || 0,
          description: "Program registrations and enrollments",
          href: "/customer/programs",
          icon: GraduationCap,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string
    title: string
    value: number | string
    description: string
    href: string
    icon: React.ElementType
  }>

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((item) => {
          const theme = cardThemes[item.key] ?? cardThemes.profile
          const Icon = item.icon

          return (
            <Link key={item.key} href={item.href} className="block h-full">
              <Card
                className={`h-full border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${theme.border}`}
              >
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground">{item.title}</p>
                      <p className={`mt-1 text-2xl font-bold ${theme.valueClass}`}>
                        {item.value}
                      </p>
                      <p className="mt-1 min-h-4 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>

                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${theme.iconWrap}`}
                    >
                      <Icon className={`h-5 w-5 ${theme.icon}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </section>

      {donationsModuleEnabled ? (
        <CustomerDashboardGivingSection
          campaigns={activeCampaigns}
          categories={activeCategories}
        />
      ) : null}
    </div>
  )
}
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CalendarDays,
  Gift,
  GraduationCap,
  HeartHandshake,
  ArrowRight,
  User,
  Building2,
  Briefcase,
} from "lucide-react"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getUserPortalCapabilities } from "@/lib/auth/portal-capabilities"
import {
  isCustomerPortalModuleEnabled,
} from "@/lib/customer/customer-portal-modules"
import { loadCustomerPortalEnabledModuleSlugs } from "@/lib/customer/customer-portal-modules-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function CustomerDashboardPage() {
  const { supabase, session } = await getCustomerPortalSupabase()
  const userId = session.effectiveUserId
  const user = session.authenticatedUser

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  const organizationId = activeOrganization.organization_id

  const portalCapabilities = await getUserPortalCapabilities(userId, organizationId)
  const enabledModuleSlugs = await loadCustomerPortalEnabledModuleSlugs(organizationId)

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, email, organization_id")
    .eq("auth_user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const firstName =
    contact?.full_name?.split(" ")?.[0] ||
    contact?.email?.split("@")?.[0] ||
    user.email?.split("@")?.[0] ||
    "there"

  const { count: rentalsCount } = isCustomerPortalModuleEnabled(enabledModuleSlugs, "bookings")
    ? await supabase
        .from("venue_rentals")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("customer_user_id", userId)
    : { count: 0 }

  const { count: pendingRentalsCount } = isCustomerPortalModuleEnabled(
    enabledModuleSlugs,
    "bookings"
  )
    ? await supabase
        .from("venue_rentals")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("customer_user_id", userId)
        .eq("status", "awaiting_supervisor_approval")
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

  const overviewCards = [
    isCustomerPortalModuleEnabled(enabledModuleSlugs, "bookings")
      ? {
          title: "Venue Rentals",
          value: rentalsCount || 0,
          description: "Venue requests and reservations",
          href: "/customer/rentals",
          icon: CalendarDays,
        }
      : null,
    isCustomerPortalModuleEnabled(enabledModuleSlugs, "donations")
      ? {
          title: "Donations",
          value: donationCount || 0,
          description: "Giving history and contributions",
          href: "/customer/donation",
          icon: Gift,
        }
      : null,
    isCustomerPortalModuleEnabled(enabledModuleSlugs, "programs")
      ? {
          title: "Programs",
          value: programEnrollmentCount || 0,
          description: "Program registrations and enrollments",
          href: "/customer/programs",
          icon: GraduationCap,
        }
      : null,
    {
      title: "Profile",
      value: "View",
      description: "Manage your account information",
      href: "/customer/profile",
      icon: User,
    },
  ].filter(Boolean) as Array<{
    title: string
    value: number | string
    description: string
    href: string
    icon: React.ElementType
  }>

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {activeOrganization.organization_name}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              This is your portal overview for your organization&apos;s enabled
              services and account activity.
            </p>
          </div>

          {overviewCards.length > 1 ? (
            <Button asChild>
              <Link href={overviewCards[0]?.href ?? "/customer/profile"}>
                Open Portal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="flex flex-wrap gap-4 [&>*]:w-fit">
        {overviewCards.map((item) => (
          <Link key={item.title} href={item.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex h-full flex-col justify-between p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {item.title}
                    </p>
                    <p className="mt-2 text-3xl font-bold">{item.value}</p>
                  </div>

                  <div className="rounded-full bg-muted p-3">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Portal Activity</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-3 sm:grid-cols-2">
            {isCustomerPortalModuleEnabled(enabledModuleSlugs, "bookings") ? (
              <DashboardAction
                href="/customer/rentals"
                icon={CalendarDays}
                title="Venue Rentals"
                description={`${pendingRentalsCount || 0} pending request${
                  pendingRentalsCount === 1 ? "" : "s"
                }`}
              />
            ) : null}

            {isCustomerPortalModuleEnabled(enabledModuleSlugs, "donations") ? (
              <DashboardAction
                href="/customer/donation"
                icon={Gift}
                title="Donations"
                description="View giving history and donation options"
              />
            ) : null}

            {isCustomerPortalModuleEnabled(enabledModuleSlugs, "programs") ? (
              <DashboardAction
                href="/customer/programs"
                icon={HeartHandshake}
                title="Programs"
                description="View available and enrolled programs"
              />
            ) : null}

            <DashboardAction
              href="/customer/profile"
              icon={User}
              title="Profile"
              description="Update your personal information"
            />

            {portalCapabilities.hasStaffToolsPortal ? (
              <DashboardAction
                href="/customer/staff"
                icon={Briefcase}
                title="Staff Tools"
                description="Submit department event requests"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Summary</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Organization</span>
              <span className="text-right font-medium">
                {activeOrganization.organization_name}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Role</span>
              <span className="text-right font-medium">
                {activeOrganization.role_name}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="text-right font-medium">
                {contact?.email || user.email}
              </span>
            </div>

            <div className="pt-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/customer/profile">
                  <Building2 className="mr-2 h-4 w-4" />
                  Manage Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function DashboardAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <Link href={href}>
      <div className="flex h-full items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50">
        <div className="rounded-full bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  )
}
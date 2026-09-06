import Link from "next/link"
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Landmark,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { redirectOrgWideProgramPagesForDepartmentHead } from "@/lib/programs/program-access"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import {
  PROGRAMS_FINANCE_PATH,
  PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
  PROGRAMS_LIST_PATH,
  PROGRAMS_OFFERINGS_PATH,
  PROGRAMS_REGISTRATIONS_PATH,
  PROGRAMS_REPORTS_PATH,
} from "@/lib/programs/programs-module-nav"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

async function countActiveOfferings() {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return 0

  const { count, error } = await supabase
    .from("program_offerings")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("status", "archived")

  if (error) {
    console.error("[programs home] offering count", error)
    return 0
  }
  return count ?? 0
}

type QuickLinkTone = {
  card: string
  icon: string
  title: string
  description: string
}

const quickLinks: Array<{
  label: string
  href: string
  description: string
  icon: LucideIcon
  tone: QuickLinkTone
}> = [
  {
    label: "Programs",
    href: PROGRAMS_LIST_PATH,
    description: "Manage programs across all departments.",
    icon: GraduationCap,
    tone: {
      card: "border-sky-200 bg-sky-50 hover:bg-sky-100",
      icon: "bg-sky-100 text-sky-700",
      title: "text-sky-950",
      description: "text-sky-800/80",
    },
  },
  {
    label: "Offerings",
    href: PROGRAMS_OFFERINGS_PATH,
    description: "Manage offerings across all programs.",
    icon: BookOpen,
    tone: {
      card: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
      icon: "bg-emerald-100 text-emerald-700",
      title: "text-emerald-950",
      description: "text-emerald-800/80",
    },
  },
  {
    label: "Registrations",
    href: PROGRAMS_REGISTRATIONS_PATH,
    description: "Family registration and payment activity.",
    icon: ClipboardList,
    tone: {
      card: "border-violet-200 bg-violet-50 hover:bg-violet-100",
      icon: "bg-violet-100 text-violet-700",
      title: "text-violet-950",
      description: "text-violet-800/80",
    },
  },
  {
    label: "Finance",
    href: PROGRAMS_FINANCE_PATH,
    description: "Transactions and payroll for programs.",
    icon: Landmark,
    tone: {
      card: "border-amber-200 bg-amber-50 hover:bg-amber-100",
      icon: "bg-amber-100 text-amber-800",
      title: "text-amber-950",
      description: "text-amber-900/80",
    },
  },
  {
    label: "Financial Assistance",
    href: PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
    description: "Awards, submissions, and payment plans.",
    icon: LifeBuoy,
    tone: {
      card: "border-rose-200 bg-rose-50 hover:bg-rose-100",
      icon: "bg-rose-100 text-rose-700",
      title: "text-rose-950",
      description: "text-rose-800/80",
    },
  },
  {
    label: "Reports",
    href: PROGRAMS_REPORTS_PATH,
    description: "Enrollments, add-ons, waitlist, and attendance.",
    icon: BarChart3,
    tone: {
      card: "border-indigo-200 bg-indigo-50 hover:bg-indigo-100",
      icon: "bg-indigo-100 text-indigo-700",
      title: "text-indigo-950",
      description: "text-indigo-800/80",
    },
  },
]

export default async function ProgramsHomePage() {
  await redirectOrgWideProgramPagesForDepartmentHead()
  const [programs, offeringCount] = await Promise.all([
    getOpenPrograms(),
    countActiveOfferings(),
  ])

  const metrics = [
    {
      label: "Programs",
      value: programs.length,
      hint: "Years and seasons",
    },
    {
      label: "Offerings",
      value: offeringCount,
      hint: "Classes families can register for",
    },
  ]

  return (
    <>
      <Header title="Overview" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Years, seasons, offerings, registrations, and program finance in one
            place.
          </p>
        </div>

        <StatCardsRow>
          {metrics.map((metric) => (
            <StatCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
            />
          ))}
        </StatCardsRow>

        <div className="grid gap-4 md:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card
                className={cn(
                  "h-full shadow-none transition-colors",
                  link.tone.card
                )}
              >
                <CardHeader className="flex flex-row items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      link.tone.icon
                    )}
                  >
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className={cn("text-base", link.tone.title)}>
                      {link.label}
                    </CardTitle>
                    <CardDescription
                      className={cn("mt-1.5", link.tone.description)}
                    >
                      {link.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}

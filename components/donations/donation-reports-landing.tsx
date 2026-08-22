"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRight,
  BarChart3,
  HeartHandshake,
  Repeat,
  Target,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DONATION_RANGE_LABELS,
  DONATION_RANGE_PRESETS,
  parseDonationRangeParam,
  type DonationRangePreset,
} from "@/lib/donations/donation-date-range"
import {
  DONATION_REPORTS_CAMPAIGNS_PATH,
  DONATION_REPORTS_DONORS_PATH,
  DONATION_REPORTS_GIVING_PATH,
  DONATION_REPORTS_PLEDGES_ANALYTICS_PATH,
  DONATION_REPORTS_RECURRING_ANALYTICS_PATH,
} from "@/lib/donations/donation-payment-paths"

const DEFAULT_RANGE: DonationRangePreset = "30d"

function reportHref(path: string, range: DonationRangePreset, usesRange: boolean) {
  if (!usesRange || range === DEFAULT_RANGE) return path
  const params = new URLSearchParams()
  params.set("range", range)
  return `${path}?${params.toString()}`
}

const REPORTS = [
  {
    name: "Giving Summary",
    description:
      "Overall donation volume, gift count, average gift, and payment activity for this organization.",
    href: DONATION_REPORTS_GIVING_PATH,
    icon: BarChart3,
    accent: "bg-blue-100 text-blue-600",
    usesRange: true,
  },
  {
    name: "Donor Giving",
    description: "Analyze individual, household, and CRM group giving without duplicating gifts.",
    href: DONATION_REPORTS_DONORS_PATH,
    icon: Users,
    accent: "bg-emerald-100 text-emerald-600",
    usesRange: false,
  },
  {
    name: "Campaign Performance",
    description:
      "Compare campaigns and campaign fundraising groups: goals, pledged, collected, and outstanding.",
    href: DONATION_REPORTS_CAMPAIGNS_PATH,
    icon: Target,
    accent: "bg-violet-100 text-violet-600",
    usesRange: false,
  },
  {
    name: "Pledge Performance",
    description: "Analyze commitments, collections, balances, fulfillment, and overdue pledges.",
    href: DONATION_REPORTS_PLEDGES_ANALYTICS_PATH,
    icon: HeartHandshake,
    accent: "bg-amber-100 text-amber-600",
    usesRange: false,
  },
  {
    name: "Recurring Giving",
    description: "Analyze recurring donors, recurring revenue, and plan status trends.",
    href: DONATION_REPORTS_RECURRING_ANALYTICS_PATH,
    icon: Repeat,
    accent: "bg-rose-100 text-rose-600",
    usesRange: false,
  },
] as const

export function DonationReportsLanding() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const range = parseDonationRangeParam(searchParams.get("range"), DEFAULT_RANGE)

  function handleRangeChange(next: DonationRangePreset) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === DEFAULT_RANGE) params.delete("range")
    else params.set("range", next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fundraising Reports</h2>
          <p className="text-sm text-muted-foreground">
            Analyze giving, donors, campaigns, pledges, and recurring fundraising performance.
          </p>
        </div>
        <Select value={range} onValueChange={(value) => handleRangeChange(value as DonationRangePreset)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DONATION_RANGE_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {DONATION_RANGE_LABELS[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon
          return (
            <Card key={report.href} className="border border-border shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-3 ${report.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{report.name}</CardTitle>
                    <CardDescription className="mt-1">{report.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href={reportHref(report.href, range, report.usesRange)}>
                    View Report
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

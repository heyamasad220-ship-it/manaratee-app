"use client"

import { useEffect, useState } from "react"
import { PlatformHeader } from "@/components/platform/platform-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Building2, Users, Banknote, Clock } from "lucide-react"

interface DashboardStats {
  totalOrganizations: number
  activeOrganizations: number
  pendingOrganizations: number
  suspendedOrganizations: number
  totalMembers: number
  monthlyRevenue: number
}

interface RecentOrg {
  id: string
  name: string
  contact_email?: string | null
  contactEmail?: string | null
  status: string | null
  created_at?: string | null
  created?: string | null
  members?: number | null
  mrr?: number | null
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  suspended: "bg-red-100 text-red-700 hover:bg-red-100",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function normalizeStatus(value: string | null | undefined) {
  return (value || "unknown").toLowerCase()
}

function formatStatus(value: string | null | undefined) {
  const status = normalizeStatus(value)

  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function PlatformDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalOrganizations: 0,
    activeOrganizations: 0,
    pendingOrganizations: 0,
    suspendedOrganizations: 0,
    totalMembers: 0,
    monthlyRevenue: 0,
  })
  const [recentOrganizations, setRecentOrganizations] = useState<RecentOrg[]>([])

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)

      try {
        const response = await fetch("/api/platform/organizations")
        const result = await response.json()

        if (!response.ok) {
          console.error("DASHBOARD ORGS ERROR:", result)
          setLoading(false)
          return
        }

        const orgs: RecentOrg[] = result.organizations || []

        const totalOrganizations = orgs.length
        const activeOrganizations = orgs.filter(
          (org) => normalizeStatus(org.status) === "active"
        ).length
        const pendingOrganizations = orgs.filter(
          (org) => normalizeStatus(org.status) === "pending"
        ).length
        const suspendedOrganizations = orgs.filter(
          (org) => normalizeStatus(org.status) === "suspended"
        ).length

        const totalMembers = orgs.reduce((sum, org) => {
          return sum + Number(org.members || 0)
        }, 0)

        const monthlyRevenue = orgs.reduce((sum, org) => {
          return sum + Number(org.mrr || 0)
        }, 0)

        setStats({
          totalOrganizations,
          activeOrganizations,
          pendingOrganizations,
          suspendedOrganizations,
          totalMembers,
          monthlyRevenue,
        })

        setRecentOrganizations(orgs.slice(0, 8))
      } catch (error) {
        console.error("DASHBOARD LOAD ERROR:", error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const statCards = [
    {
      label: "Total Organizations",
      value: stats.totalOrganizations.toLocaleString("en-US"),
      change: `${stats.activeOrganizations} active`,
      icon: Building2,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Total Members",
      value: stats.totalMembers.toLocaleString("en-US"),
      change: "Across all organizations",
      icon: Users,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Monthly Revenue",
      value: `$${stats.monthlyRevenue.toLocaleString("en-US")}`,
      change: "From organization MRR",
      icon: Banknote,
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "Pending Organizations",
      value: stats.pendingOrganizations.toLocaleString("en-US"),
      change: "Waiting for approval",
      icon: Clock,
      color: "bg-red-100 text-red-700",
    },
  ]

  return (
    <>
      <PlatformHeader title="Dashboard" />

      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="border border-border shadow-sm">
              <CardContent className="flex items-start gap-4 p-5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color}`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-2xl font-bold text-foreground">
                    {loading ? "—" : stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.change}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Card className="border border-border shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Recent Organizations
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {recentOrganizations.length} shown
                  </span>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-medium text-muted-foreground">
                        Organization
                      </TableHead>
                      <TableHead className="font-medium text-muted-foreground">
                        Admin Email
                      </TableHead>
                      <TableHead className="font-medium text-muted-foreground">
                        Created
                      </TableHead>
                      <TableHead className="font-medium text-muted-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-muted-foreground"
                        >
                          Loading dashboard...
                        </TableCell>
                      </TableRow>
                    ) : recentOrganizations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No organizations yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentOrganizations.map((org) => {
                        const status = normalizeStatus(org.status)

                        return (
                          <TableRow key={org.id}>
                            <TableCell className="font-medium text-foreground">
                              {org.name}
                            </TableCell>

                            <TableCell className="text-muted-foreground">
                              {org.contact_email || org.contactEmail || "—"}
                            </TableCell>

                            <TableCell className="text-muted-foreground">
                              {formatDate(org.created_at || org.created)}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={statusStyles[status] || ""}
                              >
                                {formatStatus(status)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border border-border shadow-sm">
              <CardContent className="p-0">
                <div className="border-b border-border px-5 py-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Organization Status
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Live count from Supabase
                  </p>
                </div>

                <div className="flex flex-col divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Active
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Currently enabled
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      {loading ? "—" : stats.activeOrganizations}
                    </p>
                  </div>

                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Pending
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Waiting for approval
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      {loading ? "—" : stats.pendingOrganizations}
                    </p>
                  </div>

                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Suspended
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Access disabled
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      {loading ? "—" : stats.suspendedOrganizations}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
"use client"

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

const stats = [
  { label: "Total Organizations", value: "142", change: "+8 this month", icon: Building2, color: "bg-emerald-100 text-emerald-700" },
  { label: "Active Users", value: "3,847", change: "+312 this month", icon: Users, color: "bg-blue-100 text-blue-700" },
  { label: "Monthly Revenue", value: "$28,450", change: "+12% from last month", icon: Banknote, color: "bg-amber-100 text-amber-700" },
  { label: "Pending Approvals", value: "7", change: "Requires attention", icon: Clock, color: "bg-red-100 text-red-700" },
]

const recentActivity = [
  { id: 1, org: "Al-Noor Community Center", action: "Subscription upgraded", plan: "Professional", date: "Feb 23, 2026", status: "Completed" },
  { id: 2, org: "Islamic Center of Austin", action: "New registration", plan: "Starter", date: "Feb 22, 2026", status: "Pending" },
  { id: 3, org: "Salam Foundation", action: "Payment received", plan: "Enterprise", date: "Feb 22, 2026", status: "Completed" },
  { id: 4, org: "Barakah Mosque", action: "Account suspended", plan: "Free", date: "Feb 21, 2026", status: "Suspended" },
  { id: 5, org: "Unity Islamic School", action: "New registration", plan: "Professional", date: "Feb 21, 2026", status: "Pending" },
  { id: 6, org: "Crescent Community Hub", action: "Payment failed", plan: "Starter", date: "Feb 20, 2026", status: "Failed" },
]

const revenueByPlan = [
  { plan: "Enterprise", amount: 12600, orgs: 14, pct: 44 },
  { plan: "Professional", amount: 9800, orgs: 49, pct: 34 },
  { plan: "Starter", amount: 4750, orgs: 47, pct: 17 },
  { plan: "Free", amount: 0, orgs: 32, pct: 0 },
]

const statusStyles: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Suspended: "bg-red-100 text-red-700 hover:bg-red-100",
  Failed: "bg-red-100 text-red-700 hover:bg-red-100",
}

export default function PlatformDashboardPage() {
  return (
    <>
      <PlatformHeader title="Dashboard" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border border-border shadow-sm">
              <CardContent className="flex items-start gap-4 p-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-0.5 text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="col-span-2">
            <Card className="border border-border shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-base font-semibold text-foreground">Recent Activity</h3>
                  <span className="text-xs text-muted-foreground">{recentActivity.length} events</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-medium text-muted-foreground">Organization</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Action</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Plan</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Date</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivity.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-foreground">{item.org}</TableCell>
                        <TableCell className="text-muted-foreground">{item.action}</TableCell>
                        <TableCell className="text-muted-foreground">{item.plan}</TableCell>
                        <TableCell className="text-muted-foreground">{item.date}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusStyles[item.status] || ""}>
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Plan */}
          <div>
            <Card className="border border-border shadow-sm">
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-base font-semibold text-foreground">Revenue by Plan</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Monthly recurring revenue breakdown</p>
                </div>
                <div className="flex flex-col gap-0 divide-y divide-border">
                  {revenueByPlan.map((item) => (
                    <div key={item.plan} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.plan}</p>
                        <p className="text-xs text-muted-foreground">{item.orgs} organizations</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.pct}% of MRR</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Users,
  Building,
  Calendar,
  Clock,
  UserPlus,
  ArrowRight,
  UsersRound,
  Crown,
  Activity,
  Baby,
  FileText,
} from "lucide-react"
import {
  fetchHrTeamDashboardStats,
  type HrTeamDashboardStats,
} from "@/lib/hr/hr-team-actions"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"

// Mock data
const stats = [
  { label: "Total Employees", value: "48", icon: Users, change: "+3 this month" },
  { label: "Departments", value: "6", icon: Building, change: "" },
  { label: "On Leave Today", value: "2", icon: Calendar, change: "" },
  { label: "Pending Requests", value: "5", icon: Clock, change: "Time off requests" },
]

const recentHires = [
  { id: "emp-006", name: "David Park", title: "IT Specialist", department: "Technology", startDate: "Feb 15, 2024" },
  { id: "emp-007", name: "Maria Santos", title: "Event Coordinator", department: "Events", startDate: "Feb 1, 2024" },
  { id: "emp-008", name: "James Wilson", title: "Finance Associate", department: "Finance", startDate: "Jan 20, 2024" },
]

const upcomingBirthdays = [
  { name: "Sarah Mitchell", date: "Mar 5", department: "Administration" },
  { name: "Michael Chen", date: "Mar 12", department: "Education" },
  { name: "Emily Rodriguez", date: "Mar 18", department: "Operations" },
]

const pendingRequests = [
  { id: "req-1", employee: "Sarah Mitchell", type: "Vacation", dates: "Mar 15-22", status: "Pending" },
  { id: "req-2", employee: "Michael Chen", type: "Sick Leave", dates: "Mar 5-6", status: "Pending" },
  { id: "req-3", employee: "Emily Rodriguez", type: "Personal", dates: "Mar 10", status: "Pending" },
]

const departmentBreakdown = [
  { name: "Administration", count: 8, color: "bg-blue-500" },
  { name: "Education", count: 12, color: "bg-emerald-500" },
  { name: "Operations", count: 10, color: "bg-amber-500" },
  { name: "Technology", count: 6, color: "bg-purple-500" },
  { name: "Events", count: 7, color: "bg-pink-500" },
  { name: "Finance", count: 5, color: "bg-cyan-500" },
]

export default function HROverviewPage() {
  const [teamStats, setTeamStats] = useState<HrTeamDashboardStats>({
    totalTeams: 0,
    activeTeams: 0,
    totalMembers: 0,
    teamLeaders: 0,
  })

  useEffect(() => {
    void fetchHrTeamDashboardStats().then(setTeamStats).catch(console.error)
  }, [])

  const teamStatCards = [
    { label: "Total Teams", value: teamStats.totalTeams, icon: UsersRound },
    { label: "Active Teams", value: teamStats.activeTeams, icon: Activity },
    { label: "Team Members", value: teamStats.totalMembers, icon: Users },
    { label: "Team Leaders", value: teamStats.teamLeaders, icon: Crown },
  ]

  return (
    <>
      <Header title={PEOPLE_MANAGEMENT_MODULE_LABEL} />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      {stat.change && (
                        <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
                      )}
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <stat.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Teams Overview</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/hr/teams">
                View Teams
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teamStatCards.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <stat.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Child Care</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/events/childcare">Registrations</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/hr/childcare">
                  Providers
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Baby className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Childcare providers directory</p>
                <p className="text-sm text-muted-foreground">
                  Manage approved providers, certifications, and event history.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Hires */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Hires</CardTitle>
                  <CardDescription>New employees who joined recently</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/hr/employees">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {recentHires.map((hire) => (
                    <div key={hire.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{hire.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <Link href={`/hr/employees/${hire.id}`} className="font-medium text-foreground hover:underline">
                            {hire.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">{hire.title}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{hire.department}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">Started {hire.startDate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Birthdays */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Birthdays</CardTitle>
                <CardDescription>This month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {upcomingBirthdays.map((birthday, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{birthday.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{birthday.name}</p>
                          <p className="text-xs text-muted-foreground">{birthday.department}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{birthday.date}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Employment Applications */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Employment Applications</CardTitle>
                  <CardDescription>Applications awaiting review</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/people-management/applications?application_type=employment">
                    Review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Review employment applications in Employees → Applications.
                </p>
              </CardContent>
            </Card>

            {/* Department Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Department Breakdown</CardTitle>
                <CardDescription>Employee distribution by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {departmentBreakdown.map((dept) => (
                    <div key={dept.name} className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${dept.color}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{dept.name}</span>
                          <span className="text-sm text-muted-foreground">{dept.count} employees</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full ${dept.color}`}
                            style={{ width: `${(dept.count / 48) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
                  <Link href="/hr/employees">
                    <UserPlus className="h-6 w-6" />
                    <span>Add Employee</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
                  <Link href="/hr/employees?tab=departments">
                    <Building className="h-6 w-6" />
                    <span>Manage Departments</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
                  <Link href="/hr/teams">
                    <UsersRound className="h-6 w-6" />
                    <span>Manage Teams</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
                  <Link href="/people-management/applications?application_type=employment">
                    <FileText className="h-6 w-6" />
                    <span>Employment Applications</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

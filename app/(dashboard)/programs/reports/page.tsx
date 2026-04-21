"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, FileText, Users, DollarSign, TrendingUp, Calendar, GraduationCap, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

const reportsTabs = ["Overview", "Enrollment", "Revenue", "Attendance"] as const
type ReportsTab = (typeof reportsTabs)[number]

const enrollmentData = [
  { program: "Youth Soccer League", enrolled: 64, capacity: 80, percentage: 80 },
  { program: "Summer Camp 2026", enrolled: 120, capacity: 150, percentage: 80 },
  { program: "Taekwondo Classes", enrolled: 45, capacity: 50, percentage: 90 },
  { program: "Adult Fitness Aerobics", enrolled: 32, capacity: 40, percentage: 80 },
  { program: "After School Tutoring", enrolled: 28, capacity: 30, percentage: 93 },
  { program: "Weekend Quran Class", enrolled: 75, capacity: 100, percentage: 75 },
]

const revenueByDepartment = [
  { department: "Events", amount: "$12,100", percentage: 42 },
  { department: "Education", amount: "$5,200", percentage: 18 },
  { department: "Community Outreach", amount: "$4,800", percentage: 17 },
  { department: "Technology", amount: "$3,500", percentage: 12 },
  { department: "Administration", amount: "$1,800", percentage: 6 },
  { department: "Marketing", amount: "$1,400", percentage: 5 },
]

const monthlyStats = [
  { month: "Jan", registrations: 45, revenue: 12500 },
  { month: "Feb", registrations: 62, revenue: 16800 },
  { month: "Mar", registrations: 78, revenue: 21200 },
]

export default function ProgramsReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>("Overview")
  const [dateRange, setDateRange] = useState("this-month")

  return (
    <>
      <Header title="Programs" />
      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Reports</h2>
            <p className="text-sm text-muted-foreground">
              Program analytics and performance metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="this-quarter">This Quarter</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="mb-6 flex gap-0 border-b border-border">
          {reportsTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "Overview" && (
          <div className="flex flex-col gap-6">
            {/* Summary Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Programs</p>
                    <p className="text-2xl font-bold">24</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-green-100 p-3 text-green-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Enrolled</p>
                    <p className="text-2xl font-bold">486</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-purple-100 p-3 text-purple-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                    <p className="text-2xl font-bold">$23,600</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-amber-100 p-3 text-amber-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Attendance</p>
                    <p className="text-2xl font-bold">87%</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Reports */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Enrollment Summary</p>
                    <p className="text-sm text-muted-foreground">Program enrollment details</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Revenue Report</p>
                    <p className="text-sm text-muted-foreground">Income by program and department</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Attendance Report</p>
                    <p className="text-sm text-muted-foreground">Class attendance tracking</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Instructor Performance</p>
                    <p className="text-sm text-muted-foreground">Instructor stats and feedback</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Program Comparison</p>
                    <p className="text-sm text-muted-foreground">Compare program metrics</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Growth Analysis</p>
                    <p className="text-sm text-muted-foreground">Year-over-year trends</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Enrollment Tab */}
        {activeTab === "Enrollment" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Enrollment by Program</CardTitle>
                <CardDescription>Current enrollment vs capacity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {enrollmentData.map((item) => (
                    <div key={item.program} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.program}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.enrolled}/{item.capacity} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            item.percentage >= 90
                              ? "bg-red-500"
                              : item.percentage >= 75
                              ? "bg-amber-500"
                              : "bg-green-500"
                          )}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === "Revenue" && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">$23,600</p>
                  <p className="text-xs text-green-600">+12% vs last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Avg per Registration</p>
                  <p className="text-2xl font-bold">$158</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-bold">$1,450</p>
                  <p className="text-xs text-muted-foreground">12 pending payments</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Department</CardTitle>
                <CardDescription>Breakdown by program department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
{revenueByDepartment.map((item) => (
                      <div key={item.department} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full bg-primary" />
                          <span className="text-sm font-medium">{item.department}</span>
                        </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{item.percentage}%</span>
                        <span className="w-20 text-right font-medium">{item.amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === "Attendance" && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Overall Attendance</p>
                  <p className="text-2xl font-bold">87%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Classes This Month</p>
                  <p className="text-2xl font-bold">156</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Avg Class Size</p>
                  <p className="text-2xl font-bold">18</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Attendance by Program</CardTitle>
                <CardDescription>Average attendance rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {[
                    { program: "Taekwondo Classes", attendance: 94 },
                    { program: "Adult Fitness Aerobics", attendance: 91 },
                    { program: "Youth Soccer League", attendance: 88 },
                    { program: "After School Tutoring", attendance: 85 },
                    { program: "Weekend Quran Class", attendance: 82 },
                    { program: "Basketball Training", attendance: 79 },
                  ].map((item) => (
                    <div key={item.program} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.program}</span>
                        <span className="text-sm text-muted-foreground">{item.attendance}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${item.attendance}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}

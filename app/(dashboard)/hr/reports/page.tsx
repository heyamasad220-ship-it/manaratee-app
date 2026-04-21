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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Users, Calendar, Clock, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

const reportsTabs = ["Overview", "Headcount", "Attendance", "Time Off"] as const
type ReportsTab = (typeof reportsTabs)[number]

export default function HRReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>("Overview")
  const [dateRange, setDateRange] = useState("30d")

  return (
    <>
      <Header title="HR Reports" />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-0 border-b border-border">
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
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {activeTab === "Overview" && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">48</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+3</span> this period
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">
                    6 avg employees/dept
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Attendance Rate</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">94.5%</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+1.2%</span> from last period
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Time Off Used</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156 days</div>
                  <p className="text-xs text-muted-foreground">
                    Across all employees
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Employees by Department</CardTitle>
                  <CardDescription>Headcount distribution across departments</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Administration</TableCell>
                        <TableCell>12</TableCell>
                        <TableCell className="text-right">25%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Education</TableCell>
                        <TableCell>10</TableCell>
                        <TableCell className="text-right">21%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Operations</TableCell>
                        <TableCell>8</TableCell>
                        <TableCell className="text-right">17%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Events</TableCell>
                        <TableCell>6</TableCell>
                        <TableCell className="text-right">13%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Hires</CardTitle>
                  <CardDescription>New employees this period</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Start Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Sarah Ahmed</TableCell>
                        <TableCell>Education</TableCell>
                        <TableCell>Feb 15, 2026</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Michael Chen</TableCell>
                        <TableCell>Technology</TableCell>
                        <TableCell>Feb 1, 2026</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Fatima Hassan</TableCell>
                        <TableCell>Administration</TableCell>
                        <TableCell>Jan 15, 2026</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "Headcount" && (
          <Card>
            <CardHeader>
              <CardTitle>Headcount Report</CardTitle>
              <CardDescription>Employee count by department and employment type</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Full-Time</TableHead>
                    <TableHead>Part-Time</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Administration</TableCell>
                    <TableCell>10</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>0</TableCell>
                    <TableCell className="text-right font-medium">12</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Education</TableCell>
                    <TableCell>6</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell className="text-right font-medium">10</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Operations</TableCell>
                    <TableCell>5</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell className="text-right font-medium">8</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Events</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell className="text-right font-medium">6</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Technology</TableCell>
                    <TableCell>4</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell className="text-right font-medium">6</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="font-semibold">28</TableCell>
                    <TableCell className="font-semibold">10</TableCell>
                    <TableCell className="font-semibold">4</TableCell>
                    <TableCell className="text-right font-semibold">42</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Attendance" && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance Report</CardTitle>
              <CardDescription>Daily attendance metrics by department</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Expected Days</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Administration</TableCell>
                    <TableCell>264</TableCell>
                    <TableCell>252</TableCell>
                    <TableCell>8</TableCell>
                    <TableCell>4</TableCell>
                    <TableCell className="text-right">95.5%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Education</TableCell>
                    <TableCell>220</TableCell>
                    <TableCell>205</TableCell>
                    <TableCell>10</TableCell>
                    <TableCell>5</TableCell>
                    <TableCell className="text-right">93.2%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Operations</TableCell>
                    <TableCell>176</TableCell>
                    <TableCell>168</TableCell>
                    <TableCell>5</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell className="text-right">95.5%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Events</TableCell>
                    <TableCell>132</TableCell>
                    <TableCell>125</TableCell>
                    <TableCell>4</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell className="text-right">94.7%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Time Off" && (
          <Card>
            <CardHeader>
              <CardTitle>Time Off Report</CardTitle>
              <CardDescription>Leave usage by type and department</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Vacation</TableHead>
                    <TableHead>Sick Leave</TableHead>
                    <TableHead>Personal</TableHead>
                    <TableHead>Other</TableHead>
                    <TableHead className="text-right">Total Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Administration</TableCell>
                    <TableCell>24</TableCell>
                    <TableCell>8</TableCell>
                    <TableCell>6</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell className="text-right font-medium">40</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Education</TableCell>
                    <TableCell>20</TableCell>
                    <TableCell>12</TableCell>
                    <TableCell>4</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell className="text-right font-medium">38</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Operations</TableCell>
                    <TableCell>16</TableCell>
                    <TableCell>6</TableCell>
                    <TableCell>4</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell className="text-right font-medium">28</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Events</TableCell>
                    <TableCell>12</TableCell>
                    <TableCell>4</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell className="text-right font-medium">20</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

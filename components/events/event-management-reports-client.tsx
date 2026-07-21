"use client"

import { useState } from "react"
import Link from "next/link"
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
import { Download, TrendingUp, Ticket, DollarSign, Users, Baby, Heart, Store } from "lucide-react"
import { cn } from "@/lib/utils"

const reportCategories = ["Ticketing", "Operations"] as const
type ReportCategory = (typeof reportCategories)[number]

const ticketingTabs = ["Overview", "Sales", "Events", "Customers"] as const
type TicketingTab = (typeof ticketingTabs)[number]

export function EventManagementReportsClient() {
  const [category, setCategory] = useState<ReportCategory>("Ticketing")
  const [ticketingTab, setTicketingTab] = useState<TicketingTab>("Overview")
  const [dateRange, setDateRange] = useState("30d")

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-0 border-b border-border">
          {reportCategories.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCategory(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                category === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {category === tab ? (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              ) : null}
            </button>
          ))}
        </div>

        {category === "Ticketing" ? (
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
        ) : null}
      </div>

      {category === "Operations" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="h-4 w-4" />
                Volunteers
              </CardTitle>
              <CardDescription>
                Coverage, sign-ups, and confirmation rates by event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming soon.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Baby className="h-4 w-4" />
                Childcare
              </CardTitle>
              <CardDescription>
                Registrations, capacity, and provider assignments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link href="/event-management/reports/childcare">Open registrations</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-4 w-4" />
                Vendors
              </CardTitle>
              <CardDescription>
                Applications, approvals, and booth participation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming soon.</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="mb-6 flex gap-0 border-b border-border">
            {ticketingTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTicketingTab(tab)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  ticketingTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
                {ticketingTab === tab ? (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                ) : null}
              </button>
            ))}
          </div>

          {ticketingTab === "Overview" ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-4 [&>*]:w-fit">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Sales
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$24,580</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600">+12%</span> from last period
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Tickets Sold
                    </CardTitle>
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">1,248</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600">+8%</span> from last period
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Avg. Order Value
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$19.70</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600">+3%</span> from last period
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Unique Customers
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">892</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600">+15%</span> from last period
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Events</CardTitle>
                  <CardDescription>
                    Events with the highest ticket sales this period
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Tickets Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Annual Gala Dinner</TableCell>
                        <TableCell>Mar 15, 2026</TableCell>
                        <TableCell className="text-right">245</TableCell>
                        <TableCell className="text-right">$12,250</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Spring Workshop Series</TableCell>
                        <TableCell>Apr 5, 2026</TableCell>
                        <TableCell className="text-right">180</TableCell>
                        <TableCell className="text-right">$5,400</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Community Concert</TableCell>
                        <TableCell>Mar 22, 2026</TableCell>
                        <TableCell className="text-right">156</TableCell>
                        <TableCell className="text-right">$3,120</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {ticketingTab === "Sales" ? (
            <Card>
              <CardHeader>
                <CardTitle>Sales Report</CardTitle>
                <CardDescription>Detailed breakdown of ticket sales by date</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead className="text-right">Gross Sales</TableHead>
                      <TableHead className="text-right">Refunds</TableHead>
                      <TableHead className="text-right">Net Sales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(7)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>Feb {28 - i}, 2026</TableCell>
                        <TableCell>{12 + i * 3}</TableCell>
                        <TableCell>{24 + i * 5}</TableCell>
                        <TableCell className="text-right">
                          ${(480 + i * 120).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-600">-${i * 25}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${(480 + i * 120 - i * 25).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {ticketingTab === "Events" ? (
            <Card>
              <CardHeader>
                <CardTitle>Events Report</CardTitle>
                <CardDescription>Performance breakdown by event</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Sold</TableHead>
                      <TableHead>Fill Rate</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Annual Gala Dinner</TableCell>
                      <TableCell>Mar 15, 2026</TableCell>
                      <TableCell>300</TableCell>
                      <TableCell>245</TableCell>
                      <TableCell>82%</TableCell>
                      <TableCell className="text-right">$12,250</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Spring Workshop</TableCell>
                      <TableCell>Apr 5, 2026</TableCell>
                      <TableCell>50</TableCell>
                      <TableCell>48</TableCell>
                      <TableCell>96%</TableCell>
                      <TableCell className="text-right">$1,440</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {ticketingTab === "Customers" ? (
            <Card>
              <CardHeader>
                <CardTitle>Customer Report</CardTitle>
                <CardDescription>Top customers by purchase volume</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Sarah Johnson</TableCell>
                      <TableCell>sarah.j@email.com</TableCell>
                      <TableCell>8</TableCell>
                      <TableCell>24</TableCell>
                      <TableCell className="text-right">$1,200</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Michael Chen</TableCell>
                      <TableCell>m.chen@email.com</TableCell>
                      <TableCell>6</TableCell>
                      <TableCell>18</TableCell>
                      <TableCell className="text-right">$890</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}

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
import { Download, Store, DollarSign, Users, Utensils } from "lucide-react"
import { cn } from "@/lib/utils"

const reportsTabs = ["Overview", "Vendor Sales", "Booth Performance", "Activities"] as const
type ReportsTab = (typeof reportsTabs)[number]

export default function BazaarReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>("Overview")
  const [eventFilter, setEventFilter] = useState("all")

  return (
    <>
      <Header title="Bazaar Reports" />
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
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="spring-2026">Spring Bazaar 2026</SelectItem>
                <SelectItem value="eid-2025">Eid Bazaar 2025</SelectItem>
                <SelectItem value="winter-2025">Winter Bazaar 2025</SelectItem>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$32,450</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+24%</span> from last event
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendors</CardTitle>
                  <Store className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">48</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+8</span> from last event
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Food Trucks</CardTitle>
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+3</span> from last event
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Est. Attendance</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2,500</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+15%</span> from last event
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Category</CardTitle>
                  <CardDescription>Breakdown of booth fees by vendor type</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Vendors</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Food</TableCell>
                        <TableCell>18</TableCell>
                        <TableCell className="text-right">$12,600</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Clothing</TableCell>
                        <TableCell>12</TableCell>
                        <TableCell className="text-right">$7,200</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Crafts</TableCell>
                        <TableCell>10</TableCell>
                        <TableCell className="text-right">$5,000</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Activities</TableCell>
                        <TableCell>8</TableCell>
                        <TableCell className="text-right">$4,000</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Vendors</CardTitle>
                  <CardDescription>Vendors with highest booth fees paid</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Fees Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Halal Bites</TableCell>
                        <TableCell>Food Truck</TableCell>
                        <TableCell className="text-right">$1,500</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Modest Fashion Co</TableCell>
                        <TableCell>Clothing</TableCell>
                        <TableCell className="text-right">$1,200</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Artisan Crafts</TableCell>
                        <TableCell>Crafts</TableCell>
                        <TableCell className="text-right">$800</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "Vendor Sales" && (
          <Card>
            <CardHeader>
              <CardTitle>Vendor Sales Report</CardTitle>
              <CardDescription>Complete vendor listing with booth fees and status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Booth Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Booth Fee</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Halal Bites</TableCell>
                    <TableCell>Food</TableCell>
                    <TableCell>Premium</TableCell>
                    <TableCell><span className="text-green-600">Paid</span></TableCell>
                    <TableCell className="text-right">$1,500</TableCell>
                    <TableCell className="text-right">$1,500</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Modest Fashion</TableCell>
                    <TableCell>Clothing</TableCell>
                    <TableCell>Corner</TableCell>
                    <TableCell><span className="text-green-600">Paid</span></TableCell>
                    <TableCell className="text-right">$1,200</TableCell>
                    <TableCell className="text-right">$1,200</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Sweet Treats</TableCell>
                    <TableCell>Food</TableCell>
                    <TableCell>Standard</TableCell>
                    <TableCell><span className="text-yellow-600">Partial</span></TableCell>
                    <TableCell className="text-right">$600</TableCell>
                    <TableCell className="text-right">$300</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Booth Performance" && (
          <Card>
            <CardHeader>
              <CardTitle>Booth Performance Report</CardTitle>
              <CardDescription>Booth allocation and utilization metrics</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booth Type</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Allocated</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Premium</TableCell>
                    <TableCell>10</TableCell>
                    <TableCell>10</TableCell>
                    <TableCell>0</TableCell>
                    <TableCell>100%</TableCell>
                    <TableCell className="text-right">$15,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Corner</TableCell>
                    <TableCell>8</TableCell>
                    <TableCell>7</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>88%</TableCell>
                    <TableCell className="text-right">$8,400</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Standard</TableCell>
                    <TableCell>30</TableCell>
                    <TableCell>25</TableCell>
                    <TableCell>5</TableCell>
                    <TableCell>83%</TableCell>
                    <TableCell className="text-right">$15,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Food Booth</TableCell>
                    <TableCell>15</TableCell>
                    <TableCell>12</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell>80%</TableCell>
                    <TableCell className="text-right">$9,600</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Activities" && (
          <Card>
            <CardHeader>
              <CardTitle>Activities Report</CardTitle>
              <CardDescription>Performance metrics for activities and entertainment</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Bounce House</TableCell>
                    <TableCell>Kids Activity</TableCell>
                    <TableCell>Fun Time Rentals</TableCell>
                    <TableCell>8 hours</TableCell>
                    <TableCell className="text-right">$400</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Face Painting</TableCell>
                    <TableCell>Kids Activity</TableCell>
                    <TableCell>Creative Arts</TableCell>
                    <TableCell>6 hours</TableCell>
                    <TableCell className="text-right">$300</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Henna Station</TableCell>
                    <TableCell>Arts</TableCell>
                    <TableCell>Mehndi by Sara</TableCell>
                    <TableCell>8 hours</TableCell>
                    <TableCell className="text-right">$500</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Live Nasheed</TableCell>
                    <TableCell>Entertainment</TableCell>
                    <TableCell>Local Artists</TableCell>
                    <TableCell>3 hours</TableCell>
                    <TableCell className="text-right">$600</TableCell>
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

"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const settingsTabs = ["General", "Time Off Policies", "Work Schedule", "Notifications"] as const
type SettingsTab = (typeof settingsTabs)[number]

const timeOffPolicies = [
  { id: "p-1", name: "Vacation", daysPerYear: 15, carryOver: true, maxCarryOver: 5 },
  { id: "p-2", name: "Sick Leave", daysPerYear: 10, carryOver: false, maxCarryOver: 0 },
  { id: "p-3", name: "Personal Days", daysPerYear: 3, carryOver: false, maxCarryOver: 0 },
  { id: "p-4", name: "Bereavement", daysPerYear: 5, carryOver: false, maxCarryOver: 0 },
  { id: "p-5", name: "Parental Leave", daysPerYear: 60, carryOver: false, maxCarryOver: 0 },
]

export default function HRSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("General")
  const [policies, setPolicies] = useState(timeOffPolicies)

  return (
    <>
      <Header title="HR Settings" />
      <div className="p-6">
        <div className="mb-6 flex gap-0 border-b border-border">
          {settingsTabs.map((tab) => (
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

        {activeTab === "General" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
                <CardDescription>General HR configuration for your organization</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="fiscal-year">Fiscal Year Start</Label>
                    <Select defaultValue="january">
                      <SelectTrigger id="fiscal-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="january">January</SelectItem>
                        <SelectItem value="april">April</SelectItem>
                        <SelectItem value="july">July</SelectItem>
                        <SelectItem value="october">October</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="timezone">Default Timezone</Label>
                    <Select defaultValue="est">
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="est">Eastern Time (ET)</SelectItem>
                        <SelectItem value="cst">Central Time (CT)</SelectItem>
                        <SelectItem value="mst">Mountain Time (MT)</SelectItem>
                        <SelectItem value="pst">Pacific Time (PT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="probation">Probation Period (days)</Label>
                    <Input id="probation" type="number" defaultValue="90" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="notice">Notice Period (days)</Label>
                    <Input id="notice" type="number" defaultValue="14" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Employee ID Format</CardTitle>
                <CardDescription>Configure how employee IDs are generated</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="prefix">ID Prefix</Label>
                    <Input id="prefix" defaultValue="EMP" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="starting-number">Starting Number</Label>
                    <Input id="starting-number" type="number" defaultValue="1001" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Example ID: EMP-1001
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}

        {activeTab === "Time Off Policies" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Time Off Policies</h3>
                <p className="text-sm text-muted-foreground">
                  Configure leave types and annual allocations
                </p>
              </div>
              <Button>Add Policy</Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Days Per Year</TableHead>
                      <TableHead>Carry Over</TableHead>
                      <TableHead>Max Carry Over</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">{policy.name}</TableCell>
                        <TableCell>{policy.daysPerYear}</TableCell>
                        <TableCell>{policy.carryOver ? "Yes" : "No"}</TableCell>
                        <TableCell>{policy.carryOver ? `${policy.maxCarryOver} days` : "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => setPolicies(policies.filter((p) => p.id !== policy.id))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "Work Schedule" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Standard Work Week</CardTitle>
                <CardDescription>Configure default work schedule</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="work-days">Work Days</Label>
                    <Select defaultValue="mon-fri">
                      <SelectTrigger id="work-days">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mon-fri">Monday - Friday</SelectItem>
                        <SelectItem value="mon-sat">Monday - Saturday</SelectItem>
                        <SelectItem value="sun-thu">Sunday - Thursday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="hours-per-week">Hours Per Week</Label>
                    <Input id="hours-per-week" type="number" defaultValue="40" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="start-time">Work Day Start</Label>
                    <Input id="start-time" type="time" defaultValue="09:00" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="end-time">Work Day End</Label>
                    <Input id="end-time" type="time" defaultValue="17:00" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overtime Settings</CardTitle>
                <CardDescription>Configure overtime policies</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Overtime Tracking</Label>
                      <p className="text-sm text-muted-foreground">
                        Track hours worked beyond standard schedule
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="overtime-threshold">Overtime Threshold (hours/week)</Label>
                    <Input id="overtime-threshold" type="number" defaultValue="40" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="overtime-rate">Overtime Rate Multiplier</Label>
                    <Input id="overtime-rate" type="number" step="0.1" defaultValue="1.5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}

        {activeTab === "Notifications" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Configure HR-related email notifications</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>New Employee Onboarding</Label>
                      <p className="text-sm text-muted-foreground">
                        Send welcome email to new employees
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Time Off Request Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify managers of pending time off requests
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Birthday Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Send birthday reminders to HR team
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Work Anniversary Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Send work anniversary reminders to managers
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Probation End Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify managers before employee probation ends
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

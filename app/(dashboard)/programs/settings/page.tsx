"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const settingsTabs = ["General", "Departments", "Registration", "Notifications"] as const
type SettingsTab = (typeof settingsTabs)[number]

const defaultDepartments = [
  { id: "dept-1", name: "Administration", description: "Administrative programs and services", programs: 2, color: "#6b7280" },
  { id: "dept-2", name: "Education", description: "Educational and tutoring programs", programs: 4, color: "#8b5cf6" },
  { id: "dept-3", name: "Operations", description: "Operational programs and logistics", programs: 1, color: "#0ea5e9" },
  { id: "dept-4", name: "Technology", description: "Tech workshops and training", programs: 2, color: "#14b8a6" },
  { id: "dept-5", name: "Events", description: "Sports, fitness, and event programs", programs: 5, color: "#22c55e" },
  { id: "dept-6", name: "Finance", description: "Financial literacy programs", programs: 1, color: "#f59e0b" },
  { id: "dept-7", name: "Marketing", description: "Marketing and communications", programs: 1, color: "#ec4899" },
  { id: "dept-8", name: "Community Outreach", description: "Community engagement and outreach programs", programs: 3, color: "#3b82f6" },
]

export default function ProgramsSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("General")
  const [departments, setDepartments] = useState(defaultDepartments)
  const [showAddDepartmentDialog, setShowAddDepartmentDialog] = useState(false)

  return (
    <>
      <Header title="Programs" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure program settings and preferences
          </p>
        </div>

        {/* Sub-tabs */}
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

        {/* General Tab */}
        {activeTab === "General" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Program Defaults</CardTitle>
                <CardDescription>
                  Default settings for new programs
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-capacity">Default Capacity</Label>
                    <Input id="default-capacity" type="number" defaultValue="30" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-duration">Default Duration</Label>
                    <Select defaultValue="12-weeks">
                      <SelectTrigger id="default-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4-weeks">4 weeks</SelectItem>
                        <SelectItem value="8-weeks">8 weeks</SelectItem>
                        <SelectItem value="12-weeks">12 weeks</SelectItem>
                        <SelectItem value="semester">Semester</SelectItem>
                        <SelectItem value="ongoing">Ongoing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Waitlist</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable waitlist when programs reach capacity
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Payment at Registration</Label>
                      <p className="text-sm text-muted-foreground">
                        Registrations require immediate payment
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Partial Payments</Label>
                      <p className="text-sm text-muted-foreground">
                        Accept partial payments and payment plans
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Age Verification</CardTitle>
                <CardDescription>
                  Settings for participant age requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enforce Age Restrictions</Label>
                      <p className="text-sm text-muted-foreground">
                        Verify participant age during registration
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Parent/Guardian for Minors</Label>
                      <p className="text-sm text-muted-foreground">
                        Minors must have a parent/guardian on file
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

        {/* Departments Tab */}
        {activeTab === "Departments" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Program Departments</h3>
                <p className="text-sm text-muted-foreground">
                  Manage departments for organizing programs
                </p>
              </div>
              <Button onClick={() => setShowAddDepartmentDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Color</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Programs</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.id}>
                        <TableCell>
                          <div
                            className="h-6 w-6 rounded-full"
                            style={{ backgroundColor: dept.color }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell className="text-muted-foreground">{dept.description}</TableCell>
                        <TableCell>{dept.programs}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => setDepartments(departments.filter((d) => d.id !== dept.id))}
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

        {/* Registration Tab */}
        {activeTab === "Registration" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Registration Form</CardTitle>
                <CardDescription>
                  Configure registration form fields
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Collect Emergency Contact</Label>
                      <p className="text-sm text-muted-foreground">
                        Require emergency contact information
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Collect Medical Information</Label>
                      <p className="text-sm text-muted-foreground">
                        Ask for allergies and medical conditions
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Photo/Video Consent</Label>
                      <p className="text-sm text-muted-foreground">
                        Include media consent form during registration
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Liability Waiver</Label>
                      <p className="text-sm text-muted-foreground">
                        Require liability waiver signature
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cancellation Policy</CardTitle>
                <CardDescription>
                  Set refund and cancellation rules
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="full-refund">Full Refund Period</Label>
                    <Select defaultValue="7">
                      <SelectTrigger id="full-refund">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 days before start</SelectItem>
                        <SelectItem value="7">7 days before start</SelectItem>
                        <SelectItem value="14">14 days before start</SelectItem>
                        <SelectItem value="30">30 days before start</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="partial-refund">Partial Refund Period</Label>
                    <Select defaultValue="3">
                      <SelectTrigger id="partial-refund">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 day before start</SelectItem>
                        <SelectItem value="3">3 days before start</SelectItem>
                        <SelectItem value="7">7 days before start</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="cancellation-fee">Cancellation Fee</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input id="cancellation-fee" type="number" defaultValue="25" className="w-24" />
                    <span className="text-sm text-muted-foreground">or</span>
                    <Input type="number" defaultValue="10" className="w-20" />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "Notifications" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>
                  Configure when emails are sent
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Registration Confirmation</Label>
                      <p className="text-sm text-muted-foreground">
                        Send confirmation email upon registration
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Payment Receipt</Label>
                      <p className="text-sm text-muted-foreground">
                        Send receipt after payment is processed
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Class Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Send reminder before scheduled classes
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Program Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify when program details change
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Waitlist Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify when spot becomes available
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reminder Timing</CardTitle>
                <CardDescription>
                  When to send class reminders
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reminder-1">First Reminder</Label>
                    <Select defaultValue="24h">
                      <SelectTrigger id="reminder-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 hour before</SelectItem>
                        <SelectItem value="2h">2 hours before</SelectItem>
                        <SelectItem value="24h">24 hours before</SelectItem>
                        <SelectItem value="48h">48 hours before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reminder-2">Second Reminder</Label>
                    <Select defaultValue="1h">
                      <SelectTrigger id="reminder-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="1h">1 hour before</SelectItem>
                        <SelectItem value="2h">2 hours before</SelectItem>
                      </SelectContent>
                    </Select>
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

      {/* Add Department Dialog */}
      <Dialog open={showAddDepartmentDialog} onOpenChange={setShowAddDepartmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>
              Create a new program department
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="department-name">Name</Label>
              <Input id="department-name" placeholder="e.g., Youth Services" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="department-color">Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="department-color"
                  type="color"
                  className="h-10 w-20 cursor-pointer p-1"
                  defaultValue="#3b82f6"
                />
                <span className="text-sm text-muted-foreground">
                  Choose a color for the department
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="department-description">Description</Label>
              <Textarea
                id="department-description"
                placeholder="Brief description of this department"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDepartmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDepartmentDialog(false)}>
              Add Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

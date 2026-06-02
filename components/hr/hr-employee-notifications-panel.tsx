"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"

export function HrEmployeeNotificationsPanel() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Configure employee-related email notifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Configure {PEOPLE_MANAGEMENT_MODULE_LABEL.toLowerCase()}-related email notifications
          </CardDescription>
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
                  Send birthday reminders to the {PEOPLE_MANAGEMENT_MODULE_LABEL.toLowerCase()} team
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
  )
}

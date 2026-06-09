"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { TimeInput } from "@/components/ui/time-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function HrWorkSchedulePanel() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Work Schedule</h2>
        <p className="text-sm text-muted-foreground">
          Configure default work week and overtime settings for employees.
        </p>
      </div>

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
              <TimeInput id="start-time" defaultValue="09:00" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end-time">Work Day End</Label>
              <TimeInput id="end-time" defaultValue="17:00" />
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
  )
}

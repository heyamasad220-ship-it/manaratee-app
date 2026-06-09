"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { TimeInput } from "@/components/ui/time-input"
import { cn } from "@/lib/utils"

const settingsTabs = ["Availability", "General"] as const
type SettingsTab = (typeof settingsTabs)[number]

export default function CalendarSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("Availability")

  return (
    <>
      <Header title="Calendar Settings" />
      <div className="p-6">
        {/* Settings sub-tabs */}
        <div className="mb-6 flex gap-0 border-b border-border">
          {settingsTabs.map((tab) => (
            <button
              key={tab}
              suppressHydrationWarning
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

        {/* Availability tab */}
        {activeTab === "Availability" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Booking Availability</h3>
              <p className="text-sm text-muted-foreground">
                Configure when bookings can be scheduled on the calendar.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Advance Booking Window</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  How far in advance can bookings be made?
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="90" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Minimum Notice</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Minimum time before a booking can start.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="24" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Buffer Between Bookings</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Time between consecutive bookings for setup/cleanup.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="30" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Default Booking Duration</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Default duration for new bookings.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Input defaultValue="60" className="w-[100px]" />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-foreground">Allow Overlapping Bookings</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Allow multiple bookings at the same time for different spaces.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}

        {/* General tab */}
        {activeTab === "General" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">General Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure general calendar display and behavior.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Show Weekends</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Display Saturday and Sunday on the calendar.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Week Starts On</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      First day of the week on the calendar.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8">Sunday</Button>
                    <Button variant="secondary" size="sm" className="h-8">Monday</Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <Label className="text-sm font-medium text-foreground">Business Hours</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Highlight business hours on the calendar.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <TimeInput defaultValue="09:00" className="w-[140px]" />
                  <span className="text-sm text-muted-foreground">to</span>
                  <TimeInput defaultValue="21:00" className="w-[140px]" />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Show Declined Bookings</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Display declined or cancelled bookings on the calendar.
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

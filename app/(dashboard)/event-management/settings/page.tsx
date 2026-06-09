import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Header } from "@/components/layout/header"
import { EventManagementSettingsNav } from "@/components/events/event-management-settings-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementSettingsPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  return (
    <>
      <Header title="Event Management" />
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure internal event options for your organization.
          </p>
        </div>

        <EventManagementSettingsNav />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Types</CardTitle>
            <CardDescription>
              Manage workshop, fundraiser, community event, and other internal event categories.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/event-management/settings/event-types"
              className="inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              Manage event types
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

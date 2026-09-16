"use client"

import { EventManagementSettingsNav } from "@/components/events/event-management-settings-nav"
import { Header } from "@/components/layout/header"
import { TicketingEventCategoriesManager } from "@/components/tickets/ticketing-event-categories-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { TicketingEventCategory } from "@/lib/tickets/ticketing-event-category-types"

export function EventManagementCategoriesSettingsClient({
  categories,
}: {
  categories: TicketingEventCategory[]
}) {
  return (
    <>
      <Header title="Event Management" />
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Group ticketed events so staff can filter the Events list.
          </p>
        </div>

        <EventManagementSettingsNav />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event categories</CardTitle>
            <CardDescription>
              Add, rename, hide, or delete categories such as Fundraising Dinner
              or Kids Workshop. Ticketed events can be assigned a category on
              the Events list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TicketingEventCategoriesManager categories={categories} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

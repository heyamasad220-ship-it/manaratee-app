"use client"

import Link from "next/link"
import { Heart, Store } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Event Management operational reports.
 * Ticketing analytics live under Event Management → Ticketing → Reports.
 * Childcare registrations are a sibling tab on this Reports section.
 */
export function EventManagementReportsClient() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          Volunteers and vendor operational reports. Use the{" "}
          <span className="font-medium text-foreground">
            Childcare Registrations
          </span>{" "}
          tab for childcare. Ticket sales analytics are under{" "}
          <Link
            href="/event-management/ticketing/reports"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Ticketing → Reports
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
    </div>
  )
}

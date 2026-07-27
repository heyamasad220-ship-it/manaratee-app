import Link from "next/link"
import { CalendarDays, ClipboardList, GraduationCap, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const intakeOptions = [
  {
    title: "Internal department event",
    description: "Staff-owned events with volunteers, childcare, or ticketing.",
    href: "/event-management/request",
    icon: CalendarDays,
  },
  {
    title: "Venue rental",
    description: "Customer or paid external bookings with approval workflow.",
    href: "/bookings/requests",
    icon: ClipboardList,
  },
  {
    title: "Program or class",
    description: "Recurring program schedules that reserve internal spaces.",
    href: "/programs",
    icon: GraduationCap,
  },
  {
    title: "View all reservations",
    description: "Cross-module visibility, conflicts, and facility setup.",
    href: "/facilities/calendar",
    icon: Sparkles,
  },
]

export function NeedSpaceIntakeCard({
  facilitiesOnly = false,
}: {
  facilitiesOnly?: boolean
}) {
  const options = facilitiesOnly
    ? intakeOptions.filter((option) => option.href.startsWith("/facilities"))
    : intakeOptions

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {facilitiesOnly ? "Facility setup" : "Need a space?"}
        </CardTitle>
        <CardDescription>
          {facilitiesOnly
            ? "Review reservations and setup details on the calendar."
            : "Departments request space in their module. Facilities operates the building from Overview, Reservation Center, and Calendar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon

          return (
            <Button
              key={option.href}
              variant="outline"
              className="h-auto justify-start py-3 text-left"
              asChild
            >
              <Link href={option.href}>
                <Icon className="mr-3 mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block font-medium">{option.title}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </Link>
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function MasterCalendarLegend() {
  const items = [
    { label: "Internal Event", className: "bg-violet-100 text-violet-800 border-violet-200" },
    { label: "Venue Rental", className: "bg-blue-100 text-blue-800 border-blue-200" },
    { label: "Program", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    { label: "Maintenance", className: "bg-slate-200 text-slate-800 border-slate-300" },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${item.className}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  )
}

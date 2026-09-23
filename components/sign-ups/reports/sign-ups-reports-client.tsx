"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SignUpReportVolunteer } from "@/lib/sign-ups/sign-up-reports"

function display(value: string | null) {
  return value?.trim() || "—"
}

export function SignUpsReportsClient({
  volunteers,
}: {
  volunteers: SignUpReportVolunteer[]
}) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return volunteers
    return volunteers.filter((row) =>
      [
        row.eventName,
        row.volunteerName,
        row.email,
        row.phone,
        row.slot,
        row.time,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    )
  }, [search, volunteers])

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search volunteers"
          className="pl-9"
          aria-label="Search volunteers"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} volunteer{filtered.length === 1 ? "" : "s"}
      </p>

      <Table
        className="min-w-[56rem]"
        containerClassName="rounded-lg border border-border"
      >
          <TableHeader>
            <TableRow>
              <TableHead>Event name</TableHead>
              <TableHead>Volunteer name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone number</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {volunteers.length === 0
                    ? "No volunteers have signed up yet."
                    : "No volunteers match this search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={row.eventHref}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.eventName}
                    </Link>
                  </TableCell>
                  <TableCell>{row.volunteerName}</TableCell>
                  <TableCell>{display(row.email)}</TableCell>
                  <TableCell>{display(row.phone)}</TableCell>
                  <TableCell>{display(row.slot)}</TableCell>
                  <TableCell>{display(row.time)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
    </div>
  )
}

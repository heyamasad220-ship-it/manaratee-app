"use client"

import Link from "next/link"

import { RegistrationRowActions } from "@/components/programs/registration-row-actions"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

export type ProgramsRegistrationTableRow = {
  id: string
  type: "enrollment" | "waitlist"
  participantName: string
  participantContactId: string | null
  contactName: string
  contactProfileId: string | null
  contactEmail: string | null
  contactPhone: string | null
  childAge: number | null
  waitlistPosition: number | null
  offeringName: string
  registeredDateLabel: string
  feeLabel: string
  receivedLabel: string
  balanceLabel: string
  statusLabel: string | null
  statusVariant: "default" | "secondary" | "outline" | "destructive"
  enrollmentStatus: string | null
  totalAmount: number
  amountPaid: number
  notes: string | null
}

export function ProgramsRegistrationsTable({
  rows,
}: {
  rows: ProgramsRegistrationTableRow[]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Participant</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Program</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead>Fee</TableHead>
          <TableHead>Received</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[90px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.type}-${row.id}`}>
            <TableCell>
              <div>
                {row.participantContactId ? (
                  <Link
                    href={contactProfileHref(row.participantContactId)}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.participantName}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    {row.participantName}
                  </span>
                )}
                <div className="text-xs text-muted-foreground">
                  {row.childAge !== null && row.childAge !== undefined
                    ? `Age ${row.childAge}`
                    : "Age not set"}
                </div>
                {row.waitlistPosition ? (
                  <div className="text-xs text-muted-foreground">
                    Waitlist position #{row.waitlistPosition}
                  </div>
                ) : null}
              </div>
            </TableCell>

            <TableCell>
              <div>
                {row.contactProfileId ? (
                  <Link
                    href={contactProfileHref(row.contactProfileId)}
                    className="text-sm text-primary hover:underline"
                  >
                    {row.contactName}
                  </Link>
                ) : (
                  <span className="text-sm text-foreground">{row.contactName}</span>
                )}
                <div className="text-xs text-muted-foreground">
                  {row.contactEmail || "No email"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.contactPhone || "No phone"}
                </div>
              </div>
            </TableCell>

            <TableCell>
              <span className="text-sm text-foreground">{row.offeringName}</span>
            </TableCell>

            <TableCell className="text-muted-foreground">
              {row.registeredDateLabel}
            </TableCell>

            <TableCell className="font-medium">{row.feeLabel}</TableCell>
            <TableCell className="font-medium">{row.receivedLabel}</TableCell>
            <TableCell className="font-medium">{row.balanceLabel}</TableCell>

            <TableCell>
              {row.statusLabel == null ? (
                <Badge variant="secondary">N/A</Badge>
              ) : (
                <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
              )}
            </TableCell>

            <TableCell>
              <RegistrationRowActions
                registrationId={row.id}
                recordType={row.type}
                participantName={row.participantName}
                enrollmentStatus={row.enrollmentStatus}
                totalAmount={row.totalAmount}
                amountPaid={row.amountPaid}
                notes={row.notes}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

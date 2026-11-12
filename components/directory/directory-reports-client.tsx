"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, UserPlus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ListPagination } from "@/components/ui/list-pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { fetchDirectoryNewContactsAction } from "@/lib/directory/directory-report-actions"
import type {
  DirectoryDuplicateRow,
  DirectoryNewContactPeriod,
  DirectoryNewContactsPage,
} from "@/lib/directory/directory-report-types"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"

const PERIODS: Array<{ id: DirectoryNewContactPeriod; label: string }> = [
  { id: "month", label: "This month" },
  { id: "30d", label: "Last 30 days" },
  { id: "12m", label: "Last 12 months" },
]

function formatAddedOn(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function duplicateValue(row: DirectoryDuplicateRow) {
  if (row.matchType === "phone") return formatPhoneDisplay(row.value) || row.value
  return row.value
}

export function DirectoryReportsClient({
  duplicates,
  initialNewContacts,
}: {
  duplicates: DirectoryDuplicateRow[]
  initialNewContacts: DirectoryNewContactsPage
}) {
  const [period, setPeriod] = useState<DirectoryNewContactPeriod>(initialNewContacts.period)
  const [newContacts, setNewContacts] = useState(initialNewContacts)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsError, setContactsError] = useState("")

  async function loadNewContacts(nextPeriod: DirectoryNewContactPeriod, page: number) {
    setLoadingContacts(true)
    setContactsError("")
    const result = await fetchDirectoryNewContactsAction(nextPeriod, page)
    setLoadingContacts(false)
    if (!result.success) {
      setContactsError(result.error)
      return
    }
    setPeriod(nextPeriod)
    setNewContacts(result.result)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Directory Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          See who was added recently, and review people who share an email or phone.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              New contacts
            </CardTitle>
            <CardDescription>
              {loadingContacts
                ? "Loading..."
                : `${newContacts.peopleCount.toLocaleString()} ${newContacts.peopleCount === 1 ? "person" : "people"} and ${newContacts.organizationCount.toLocaleString()} ${newContacts.organizationCount === 1 ? "organization" : "organizations"} added.`}
            </CardDescription>
          </div>
          <Select
            value={period}
            onValueChange={(value) => void loadNewContacts(value as DirectoryNewContactPeriod, 1)}
          >
            <SelectTrigger className="w-[180px]" aria-label="Time period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {contactsError ? <p className="text-sm text-red-700">{contactsError}</p> : null}
          {newContacts.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No people or organizations were added in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {newContacts.contacts.map((contact) => (
                    <tr key={contact.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Link
                          href={contactProfileHref(contact.id, {
                            list: contact.kind === "organization" ? "organizations" : "people",
                          })}
                          className="font-medium text-primary hover:underline"
                        >
                          {contact.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {contact.kind === "organization" ? "Organization" : "Person"}
                      </td>
                      <td className="py-2 text-muted-foreground">{formatAddedOn(contact.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {newContacts.total > newContacts.pageSize ? (
            <ListPagination
              page={newContacts.page}
              pageSize={newContacts.pageSize}
              total={newContacts.total}
              disabled={loadingContacts}
              hidePageSize
              entryLabel="contacts"
              onPageChange={(page) => void loadNewContacts(period, page)}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Possible duplicates
          </CardTitle>
          <CardDescription>
            People with the same email or phone. Open a profile to review them. Records are not
            merged from this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {duplicates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No email or phone duplicates found.</p>
          ) : (
            duplicates.map((row) => (
              <div key={row.key} className="rounded-md border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{row.matchType === "phone" ? "Phone" : "Email"}</Badge>
                  <span className="text-sm font-medium">{duplicateValue(row)}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {row.contactIds.map((id, index) => (
                    <Link
                      key={id}
                      href={contactProfileHref(id, { list: "people" })}
                      className="text-primary hover:underline"
                    >
                      {row.names[index] || "Open profile"}
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

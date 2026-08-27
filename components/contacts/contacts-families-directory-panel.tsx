"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { fetchFamilyListSummariesAction } from "@/lib/contacts/family-actions"
import type { FamilyListSummary } from "@/lib/contacts/family-types"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { directoryFamilyPath } from "@/lib/directory/directory-paths"
import { PhoneText } from "@/components/ui/phone-text"
import { Card, CardContent } from "@/components/ui/card"
import { ListPagination } from "@/components/ui/list-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"

export function ContactsFamiliesDirectoryPanel({
  returnTo = "/directory/families",
}: {
  returnTo?: string
}) {
  const pathname = usePathname()
  const [families, setFamilies] = useState<FamilyListSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const result = await fetchFamilyListSummariesAction()
      if (cancelled) return

      if (!result.success) {
        setFamilies([])
        setError(result.error)
      } else {
        setFamilies(result.families)
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pathname])

  const pageRows = useMemo(
    () => slicePageItems(families, page, pageSize),
    [families, page, pageSize]
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="m-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading families...
            </div>
          ) : families.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No family households yet. Adding a contact creates a household; link a spouse or
              children on the contact’s Family section.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Family</TableHead>
                  <TableHead>Primary contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Members</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((household) => {
                  const primaryHref = household.primaryContactId
                    ? contactProfileHref(household.primaryContactId, {
                        list: "families",
                        returnTo,
                      })
                    : null

                  const familyHref = directoryFamilyPath(household.id)

                  return (
                    <TableRow key={household.id}>
                      <TableCell className="font-medium">
                        <Link href={familyHref} className="text-primary hover:underline">
                          {household.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {primaryHref && household.primaryName ? (
                          <Link href={primaryHref} className="text-primary hover:underline">
                            {household.primaryName}
                          </Link>
                        ) : (
                          household.primaryName || "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {household.primaryEmail || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <PhoneText value={household.primaryPhone} />
                      </TableCell>
                      <TableCell className="max-w-[16rem] text-muted-foreground">
                        {household.primaryAddress || "—"}
                      </TableCell>
                      <TableCell>{household.memberCount}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!loading && families.length > 0 ? (
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={families.length}
          entryLabel="families"
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
        />
      ) : null}
    </div>
  )
}

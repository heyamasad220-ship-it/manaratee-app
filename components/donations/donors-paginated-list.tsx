"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { fetchDonorSummaryPageAction } from "@/lib/donations/donation-list-actions"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function DonorsPaginatedList() {
  const [donors, setDonors] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const loadDonors = useCallback(async () => {
    setLoading(true)
    setError("")
    const result = await fetchDonorSummaryPageAction({
      page,
      pageSize: DONATIONS_PAGE_SIZE,
      search: debouncedSearch || undefined,
      sortBy: "full_name",
    })

    if (!result.success) {
      setError(result.error)
      setDonors([])
      setTotal(0)
    } else {
      setDonors(result.donors)
      setTotal(result.total)
    }
    setLoading(false)
  }, [page, debouncedSearch])

  useEffect(() => {
    void loadDonors()
  }, [loadDonors])

  const totalPages = Math.max(1, Math.ceil(total / DONATIONS_PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * DONATIONS_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * DONATIONS_PAGE_SIZE, total)

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search donors by name or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">
          {total > 0 ? `${rangeStart}–${rangeEnd} of ${total}` : "No donors"}
        </span>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading donors...</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : donors.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No donors yet. Donor affiliations are added automatically when a contact makes a gift.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Total Given</th>
                  <th className="text-left p-3">Gifts</th>
                  <th className="text-left p-3">Last Gift</th>
                  <th className="text-left p-3">Pledge</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((donor) => (
                  <tr key={donor.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <Link
                        href={`/donations/donors/individuals/${donor.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {donor.full_name || "Unnamed"}
                      </Link>
                    </td>
                    <td className="p-3">{donor.email || "—"}</td>
                    <td className="p-3 font-medium">
                      {formatCurrency(Number(donor.total_donations || 0))}
                    </td>
                    <td className="p-3">{donor.donation_count ?? 0}</td>
                    <td className="p-3">{formatDate(donor.last_donation_date)}</td>
                    <td className="p-3">
                      {donor.has_open_pledge ? (
                        <Badge variant="secondary">Open pledge</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  setPage((current) => Math.max(1, current - 1))
                }}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  setPage((current) => Math.min(totalPages, current + 1))
                }}
                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}

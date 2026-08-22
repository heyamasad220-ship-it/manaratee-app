"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { listCampaignWishlistReportAction } from "@/lib/donations/campaign-wishlist-actions"
import {
  WISHLIST_FUNDING_STATUS_LABELS,
  WISHLIST_ITEM_TYPE_LABELS,
  WISHLIST_PROJECT_STATUS_LABELS,
  type CampaignWishlistItemMetric,
} from "@/lib/donations/campaign-wishlist-types"
import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"

export function CampaignWishlistReportPanel({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<CampaignWishlistItemMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    const result = await listCampaignWishlistReportAction()
    if (!result.success) {
      setErrorMessage(result.error)
      setItems([])
      setLoading(false)
      return
    }
    setItems(result.items)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search.trim()) {
        const term = search.trim().toLowerCase()
        if (
          !item.name.toLowerCase().includes(term) &&
          !(item.campaignName || "").toLowerCase().includes(term)
        ) {
          return false
        }
      }
      if (statusFilter !== "all" && item.project_status !== statusFilter && item.fundingStatus !== statusFilter) {
        return false
      }
      return true
    })
  }, [items, search, statusFilter])

  function exportCsv() {
    const header = [
      "Campaign",
      "Wishlist Item",
      "Type",
      "Target",
      "Pledged",
      "Collected",
      "Remaining",
      "Funding Status",
      "Project Status",
      "Completion Date",
    ]
    const rows = filtered.map((item) => [
      item.campaignName || "",
      item.name,
      WISHLIST_ITEM_TYPE_LABELS[item.item_type],
      String(item.target_amount),
      String(item.pledged),
      String(item.collected),
      String(item.remaining),
      WISHLIST_FUNDING_STATUS_LABELS[item.fundingStatus],
      WISHLIST_PROJECT_STATUS_LABELS[item.project_status],
      item.actual_completion_date || "",
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "wishlist-performance.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 p-6"}>
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search campaign or item" value={search} onChange={(event) => setSearch(event.target.value)} className="w-[240px]" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="fully_funded">Fully Funded</SelectItem>
            <SelectItem value="partially_funded">Partially Funded</SelectItem>
          </SelectContent>
        </Select>
        <button type="button" className="text-sm font-medium text-primary" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading wishlist report…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Wishlist Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Pledged</TableHead>
              <TableHead>Collected</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Funding</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link className="text-primary hover:underline" href={donationCampaignWorkspaceHref(item.campaign_id, { tab: "wishlist" })}>
                    {item.campaignName || "Campaign"}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{WISHLIST_ITEM_TYPE_LABELS[item.item_type]}</TableCell>
                <TableCell>{formatDonationCurrency(item.target_amount)}</TableCell>
                <TableCell>{formatDonationCurrency(item.pledged)}</TableCell>
                <TableCell>{formatDonationCurrency(item.collected)}</TableCell>
                <TableCell>{formatDonationCurrency(item.remaining)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{WISHLIST_FUNDING_STATUS_LABELS[item.fundingStatus]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{WISHLIST_PROJECT_STATUS_LABELS[item.project_status]}</Badge>
                </TableCell>
                <TableCell>{item.actual_completion_date || "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground">No wishlist items.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

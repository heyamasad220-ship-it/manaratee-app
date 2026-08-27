"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { MoreHorizontal, Plus } from "lucide-react"

import { CampaignSponsorshipDialog } from "@/components/donations/campaign-sponsorship-dialog"
import { CampaignSponsorshipPackageDialog } from "@/components/donations/campaign-sponsorship-package-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  fetchCampaignSponsorshipsAction,
  listCampaignLinkedEventsAction,
} from "@/lib/donations/campaign-sponsorship-actions"
import {
  deleteSponsorshipPackageAction,
  duplicateSponsorshipPackageAction,
  fetchCampaignSponsorshipPackagesAction,
  setSponsorshipPackageActiveAction,
} from "@/lib/donations/campaign-sponsorship-package-actions"
import {
  SPONSORSHIP_PAYMENT_STATUS_LABELS,
  SPONSORSHIP_STATUS_LABELS,
  type CampaignLinkedEventOption,
  type CampaignSponsorshipListItem,
  type SponsorshipPackageListItem,
} from "@/lib/donations/campaign-sponsorship-types"
import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"

type SponsorsSection = "sponsors" | "packages"

export function CampaignSponsorsTab({
  campaignId,
  canManage,
  onChanged,
}: {
  campaignId: string
  canManage: boolean
  onChanged: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section: SponsorsSection =
    searchParams.get("section") === "packages" ? "packages" : "sponsors"

  const [sponsorships, setSponsorships] = useState<CampaignSponsorshipListItem[]>([])
  const [packages, setPackages] = useState<SponsorshipPackageListItem[]>([])
  const [events, setEvents] = useState<CampaignLinkedEventOption[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSponsorDialog, setShowSponsorDialog] = useState(false)
  const [editingPackage, setEditingPackage] = useState<SponsorshipPackageListItem | null>(null)
  const [showPackageDialog, setShowPackageDialog] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const [sponsorsResult, packagesResult, eventsResult] = await Promise.all([
      fetchCampaignSponsorshipsAction(campaignId),
      fetchCampaignSponsorshipPackagesAction(campaignId),
      listCampaignLinkedEventsAction(campaignId),
    ])
    if (!sponsorsResult.success) {
      setErrorMessage(sponsorsResult.error)
      setSponsorships([])
    } else {
      setSponsorships(sponsorsResult.sponsorships)
    }
    if (!packagesResult.success) {
      setErrorMessage(packagesResult.error)
      setPackages([])
    } else {
      setPackages(packagesResult.packages)
    }
    if (eventsResult.success) setEvents(eventsResult.events)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function setSection(next: SponsorsSection) {
    router.replace(
      donationCampaignWorkspaceHref(campaignId, {
        tab: "sponsors",
        section: next === "packages" ? "packages" : undefined,
      })
    )
  }

  const metrics = useMemo(() => {
    return sponsorships.reduce(
      (sum, row) => {
        if (row.status === "cancelled") return sum
        const collected = row.payment_status === "paid" ? row.cash_amount : 0
        const outstanding =
          row.payment_status === "paid" || row.payment_status === "waived" ? 0 : row.cash_amount
        return {
          sponsors: sum.sponsors + 1,
          committed: sum.committed + row.committed_amount,
          collected: sum.collected + collected,
          outstanding: sum.outstanding + outstanding,
          inKind: sum.inKind + row.in_kind_value,
        }
      },
      { sponsors: 0, committed: 0, collected: 0, outstanding: 0, inKind: 0 }
    )
  }, [sponsorships])

  async function handleDuplicate(pkg: SponsorshipPackageListItem) {
    const result = await duplicateSponsorshipPackageAction(pkg.id)
    if (!result.success) {
      alert(result.error)
      return
    }
    await loadData()
    onChanged()
  }

  async function handleToggleActive(pkg: SponsorshipPackageListItem) {
    const result = await setSponsorshipPackageActiveAction(pkg.id, !pkg.active)
    if (!result.success) {
      alert(result.error)
      return
    }
    await loadData()
    onChanged()
  }

  async function handleDelete(pkg: SponsorshipPackageListItem) {
    if (!confirm(`Delete ${pkg.name}? Packages used by prospects or sponsors are deactivated instead.`)) {
      return
    }
    const result = await deleteSponsorshipPackageAction(pkg.id)
    if (!result.success) {
      alert(result.error)
      if ("deactivated" in result && result.deactivated) {
        await loadData()
        onChanged()
      }
      return
    }
    await loadData()
    onChanged()
  }

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={section}
        onValueChange={(value) => {
          if (value === "sponsors" || value === "packages") setSection(value)
        }}
        variant="outline"
        size="sm"
        aria-label="Sponsorship views"
        className="w-fit bg-muted/40"
      >
        <ToggleGroupItem
          value="sponsors"
          className="px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          Sponsors
        </ToggleGroupItem>
        <ToggleGroupItem
          value="packages"
          className="px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          Packages
        </ToggleGroupItem>
      </ToggleGroup>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {section === "packages" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Sponsorship Packages</h2>
              <p className="text-sm text-muted-foreground">
                Create sponsorship levels and define the benefits sponsors receive.
              </p>
            </div>
            {canManage ? (
              <Button
                onClick={() => {
                  setEditingPackage(null)
                  setShowPackageDialog(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Package
              </Button>
            ) : null}
          </div>

          <Card className="border border-border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Related Event</TableHead>
                    <TableHead className="text-right">Benefits</TableHead>
                    <TableHead className="text-right">Sponsors</TableHead>
                    <TableHead className="text-right">Total Committed</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage ? <TableHead className="w-12" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 8 : 7} className="py-8 text-center text-muted-foreground">
                        Loading packages…
                      </TableCell>
                    </TableRow>
                  ) : packages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 8 : 7} className="py-10 text-center">
                        <p className="font-medium text-foreground">No sponsorship packages yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Create sponsorship levels with contribution amounts and sponsor benefits.
                        </p>
                        {canManage ? (
                          <Button
                            className="mt-4"
                            onClick={() => {
                              setEditingPackage(null)
                              setShowPackageDialog(true)
                            }}
                          >
                            Create First Package
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ) : (
                    packages.map((pkg) => (
                      <TableRow
                        key={pkg.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => {
                          setEditingPackage(pkg)
                          setShowPackageDialog(true)
                        }}
                      >
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDonationCurrency(pkg.amount)}
                        </TableCell>
                        <TableCell>{pkg.eventName || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{pkg.benefitCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{pkg.sponsorCount}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDonationCurrency(pkg.totalCommitted)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pkg.active ? "secondary" : "outline"}>
                            {pkg.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        {canManage ? (
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingPackage(pkg)
                                    setShowPackageDialog(true)
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void handleDuplicate(pkg)}>
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void handleToggleActive(pkg)}>
                                  {pkg.active ? "Deactivate" : "Activate"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => void handleDelete(pkg)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Sponsors</h2>
            <p className="text-sm text-muted-foreground">
              Committed sponsorships for this campaign. Outreach stays on Prospects until conversion.
            </p>
          </div>

          {!loading && sponsorships.length > 0 ? (
            <StatCardsRow equal columns={5}>
              <StatCard label="Sponsors" value={metrics.sponsors} layout="compact" fill tone="slate" />
              <StatCard
                label="Committed"
                value={formatDonationCurrency(metrics.committed)}
                layout="compact"
                fill
                tone="blue"
              />
              <StatCard
                label="Collected"
                value={formatDonationCurrency(metrics.collected)}
                layout="compact"
                fill
                tone="emerald"
              />
              <StatCard
                label="Outstanding"
                value={formatDonationCurrency(metrics.outstanding)}
                layout="compact"
                fill
                tone="amber"
              />
              <StatCard
                label="In-Kind Value"
                value={formatDonationCurrency(metrics.inKind)}
                layout="compact"
                fill
                tone="violet"
              />
            </StatCardsRow>
          ) : null}

          <Card className="border border-border shadow-sm">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sponsor</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Related Event</TableHead>
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">In-Kind</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Benefits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        Loading sponsors…
                      </TableCell>
                    </TableRow>
                  ) : sponsorships.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center">
                        <p className="font-medium text-foreground">No sponsors yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Sponsorship prospects appear here after they commit and are converted to
                          sponsors.
                        </p>
                        <Button variant="outline" className="mt-4" asChild>
                          <Link
                            href={donationCampaignWorkspaceHref(campaignId, {
                              tab: "plan",
                              section: "prospects",
                              askType: "sponsorship",
                            })}
                          >
                            View Sponsorship Prospects
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sponsorships.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => {
                          setSelectedId(row.id)
                          setShowSponsorDialog(true)
                        }}
                      >
                        <TableCell>
                          <div className="font-medium">{row.contactName}</div>
                          {row.contactEmail ? (
                            <div className="text-xs text-muted-foreground">{row.contactEmail}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>{row.packageName || "Custom"}</TableCell>
                        <TableCell>{row.eventName || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDonationCurrency(row.committed_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDonationCurrency(row.cash_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDonationCurrency(row.in_kind_value)}
                        </TableCell>
                        <TableCell>
                          {SPONSORSHIP_PAYMENT_STATUS_LABELS[row.payment_status]}
                        </TableCell>
                        <TableCell>
                          {row.benefitsTotal > 0
                            ? `${row.benefitsCompleted} / ${row.benefitsTotal}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{SPONSORSHIP_STATUS_LABELS[row.status]}</Badge>
                        </TableCell>
                        <TableCell>{row.assignedToName || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <CampaignSponsorshipDialog
        open={showSponsorDialog}
        onOpenChange={(open) => {
          setShowSponsorDialog(open)
          if (!open) {
            setSelectedId(null)
            void loadData()
          }
        }}
        campaignId={campaignId}
        canManage={canManage}
        sponsorshipId={selectedId}
        onSaved={() => {
          void loadData()
          onChanged()
        }}
      />

      <CampaignSponsorshipPackageDialog
        open={showPackageDialog}
        onOpenChange={(open) => {
          setShowPackageDialog(open)
          if (!open) setEditingPackage(null)
        }}
        campaignId={campaignId}
        canManage={canManage}
        events={events}
        pkg={editingPackage}
        onSaved={() => {
          void loadData()
          onChanged()
        }}
      />
    </div>
  )
}

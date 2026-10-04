"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Crown, DollarSign, Download, ExternalLink, HeartHandshake, Plus, QrCode, Trophy, Users } from "lucide-react"

import { PledgeContactPicker } from "@/components/donations/pledge-contact-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  createCampaignGroupAction,
  listCampaignGroupDonorsAction,
  listCampaignGroupsAction,
  searchOrganizationalGroupsAction,
  updateCampaignGroupAction,
  type CampaignGroupDonorRow,
} from "@/lib/donations/campaign-group-actions"
import {
  CAMPAIGN_GROUP_STATUSES,
  CAMPAIGN_GROUP_STATUS_LABELS,
  type CampaignGroupMetrics,
  type CampaignGroupStatus,
} from "@/lib/donations/campaign-group-types"
import {
  buildCampaignGroupDonationUrl,
  buildCampaignGroupQrImageUrl,
} from "@/lib/donations/campaign-group-urls"
import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"
import { useRouter } from "next/navigation"

type CampaignGroupsTabProps = {
  campaignId: string
  campaignName: string
  organizationId: string
  canManage: boolean
  selectedGroupId?: string | null
  onChanged?: () => void
}

type GroupFormState = {
  name: string
  status: CampaignGroupStatus
  leadContactId: string
  leadLabel: string
  organizationalGroupId: string
  organizationalGroupLabel: string
}

function emptyForm(): GroupFormState {
  return {
    name: "",
    status: "active",
    leadContactId: "",
    leadLabel: "",
    organizationalGroupId: "",
    organizationalGroupLabel: "",
  }
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function CampaignGroupsTab({
  campaignId,
  campaignName,
  organizationId,
  canManage,
  selectedGroupId,
  onChanged,
}: CampaignGroupsTabProps) {
  const router = useRouter()
  const [metrics, setMetrics] = useState<CampaignGroupMetrics[]>([])
  const [donateToken, setDonateToken] = useState("")
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [form, setForm] = useState<GroupFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [orgGroupSearch, setOrgGroupSearch] = useState("")
  const [orgGroupResults, setOrgGroupResults] = useState<
    Array<{ id: string; name: string; email: string | null }>
  >([])
  const [showQr, setShowQr] = useState(false)
  const [donorsLoading, setDonorsLoading] = useState(false)
  const [donorsError, setDonorsError] = useState<string | null>(null)
  const [donors, setDonors] = useState<CampaignGroupDonorRow[]>([])

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await listCampaignGroupsAction(campaignId)
    if (!result.success) {
      setErrorMessage(result.error)
      setMetrics([])
      setDonateToken("")
      setLoading(false)
      return
    }
    setMetrics(result.metrics)
    setDonateToken(result.donateToken)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  useEffect(() => {
    if (!selectedGroupId) {
      setDonors([])
      setDonorsError(null)
      return
    }
    let cancelled = false
    setDonorsLoading(true)
    setDonorsError(null)
    void listCampaignGroupDonorsAction(selectedGroupId).then((result) => {
      if (cancelled) return
      setDonorsLoading(false)
      if (!result.success) {
        setDonors([])
        setDonorsError(result.error)
        return
      }
      setDonors(result.donors)
    })
    return () => {
      cancelled = true
    }
  }, [selectedGroupId])

  useEffect(() => {
    if (orgGroupSearch.trim().length < 2) {
      setOrgGroupResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      const result = await searchOrganizationalGroupsAction(orgGroupSearch.trim(), 20)
      if (result.success) setOrgGroupResults(result.groups)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [orgGroupSearch])

  const selectedMetric = useMemo(
    () => metrics.find((row) => row.groupId === selectedGroupId) || null,
    [metrics, selectedGroupId]
  )

  const sortedMetrics = useMemo(
    () =>
      [...metrics].sort((left, right) => {
        if (right.groupTotal !== left.groupTotal) return right.groupTotal - left.groupTotal
        return left.name.localeCompare(right.name)
      }),
    [metrics]
  )

  const groupSummary = useMemo(() => {
    const totalRaised = sortedMetrics.reduce((sum, row) => sum + row.groupTotal, 0)
    const outstanding = sortedMetrics.reduce((sum, row) => sum + row.outstanding, 0)
    return {
      totalRaised,
      outstanding,
      largest: sortedMetrics[0] ?? null,
    }
  }, [sortedMetrics])

  const donationUrl = donateToken ? buildCampaignGroupDonationUrl(donateToken) : ""

  function openCreate() {
    setEditingGroupId(null)
    setForm(emptyForm())
    setShowDialog(true)
  }

  function openEdit(row: CampaignGroupMetrics) {
    setEditingGroupId(row.groupId)
    setForm({
      name: row.name,
      status: row.status,
      leadContactId: row.leadContactId || "",
      leadLabel: row.leadName || "",
      organizationalGroupId: row.organizationalGroupId || "",
      organizationalGroupLabel: row.organizationalGroupName || "",
    })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("Group name is required")
      return
    }

    setSaving(true)
    const payload = {
      name: form.name,
      goal_amount: null,
      status: form.status,
      lead_contact_id: form.leadContactId || null,
      organizational_group_id: form.organizationalGroupId || null,
    }

    const result = editingGroupId
      ? await updateCampaignGroupAction(editingGroupId, payload)
      : await createCampaignGroupAction(campaignId, payload)

    setSaving(false)
    if (!result.success) {
      alert(result.error)
      return
    }

    setShowDialog(false)
    await loadGroups()
    onChanged?.()
  }

  async function copyLink() {
    if (!donationUrl) return
    try {
      await navigator.clipboard.writeText(donationUrl)
    } catch {
      prompt("Copy this donation link:", donationUrl)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {selectedMetric ? (
        <>
          <div className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.replace(donationCampaignWorkspaceHref(campaignId, { tab: "groups" }))
              }
            >
              Back to Groups
            </Button>
            {canManage ? (
              <button
                type="button"
                className="mt-3 block text-left text-xl font-semibold text-primary hover:underline"
                onClick={() => openEdit(selectedMetric)}
              >
                {selectedMetric.name}
              </button>
            ) : (
              <h2 className="mt-3 text-xl font-semibold text-primary">{selectedMetric.name}</h2>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              Primary Contact:{" "}
              <span className="text-foreground">{selectedMetric.leadName || "—"}</span>
              <span className="px-2">·</span>
              Status:{" "}
              <span className="text-foreground">
                {CAMPAIGN_GROUP_STATUS_LABELS[selectedMetric.status]}
              </span>
            </p>
          </div>

          <StatCardsRow equal columns={4} className="shrink-0 gap-3">
            <StatCard
              fill
              className="h-full"
              tone="emerald"
              icon={DollarSign}
              label="Received"
              value={formatDonationCurrency(selectedMetric.collected)}
              valueClassName="text-xl"
            />
            <StatCard
              fill
              className="h-full"
              tone="violet"
              icon={HeartHandshake}
              label="Pledged, not received"
              value={formatDonationCurrency(selectedMetric.outstanding)}
              valueClassName="text-xl"
            />
            <StatCard
              fill
              className="h-full"
              tone="amber"
              icon={Trophy}
              label="Total Raised"
              value={formatDonationCurrency(selectedMetric.groupTotal)}
              valueClassName="text-xl"
            />
            <StatCard
              fill
              className="h-full"
              tone="sky"
              icon={Users}
              label="Donors"
              value={selectedMetric.donorCount.toLocaleString()}
              valueClassName="text-xl"
            />
          </StatCardsRow>

          <Card className="mr-16 min-h-0 w-full max-w-[calc(100%-4rem)] flex-1 gap-0 overflow-hidden border border-border py-0 shadow-sm">
            <CardHeader className="shrink-0 border-b py-4">
              <CardTitle className="text-base">Donors</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-0">
              {donorsLoading ? (
                <p className="px-6 py-6 text-sm text-muted-foreground">Loading donors…</p>
              ) : donorsError ? (
                <p className="px-6 py-6 text-sm text-red-600">{donorsError}</p>
              ) : donors.length === 0 ? (
                <p className="px-6 py-6 text-sm text-muted-foreground">No gifts yet for this group.</p>
              ) : (
                <Table className="w-full table-fixed" containerClassName="h-full overflow-auto">
                  <colgroup>
                    <col className="w-1/6" />
                    <col className="w-1/6" />
                    <col className="w-1/6" />
                    <col className="w-1/6" />
                    <col className="w-1/6" />
                    <col className="w-1/6" />
                  </colgroup>
                  <TableHeader className="sticky top-0 z-10 bg-card [&_th]:bg-card">
                    <TableRow>
                      <TableHead className="px-4">Donor</TableHead>
                      <TableHead className="px-4">Amount</TableHead>
                      <TableHead className="px-4">Type</TableHead>
                      <TableHead className="px-4">Pledged</TableHead>
                      <TableHead className="px-4">Received</TableHead>
                      <TableHead className="px-4">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donors.map((donor) => (
                      <TableRow key={donor.key}>
                        <TableCell className="px-4">
                          {donor.contactId ? (
                            <a
                              href={contactProfileHref(donor.contactId, "financial")}
                              className="font-medium text-primary hover:underline"
                            >
                              {donor.name}
                            </a>
                          ) : (
                            donor.name
                          )}
                        </TableCell>
                        <TableCell className="px-4 tabular-nums">
                          {donor.amount != null ? formatDonationCurrency(donor.amount) : "—"}
                        </TableCell>
                        <TableCell className="px-4">
                          {donor.kind === "pledge" ? "Pledge" : "One-time donation"}
                        </TableCell>
                        <TableCell className="px-4 tabular-nums">
                          {donor.pledged != null ? formatDonationCurrency(donor.pledged) : "—"}
                        </TableCell>
                        <TableCell className="px-4 tabular-nums">
                          {donor.received != null ? formatDonationCurrency(donor.received) : "—"}
                        </TableCell>
                        <TableCell className="px-4 tabular-nums">
                          {donor.outstanding != null
                            ? formatDonationCurrency(donor.outstanding)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Groups</h2>
              <p className="text-sm text-muted-foreground">
                Total raised is money received plus pledges not yet received. The shared link shows received only, and the donor chooses a group.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!donationUrl}
                onClick={() => void copyLink()}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </Button>
              {donationUrl ? (
                <Button variant="outline" asChild>
                  <a href={donationUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open page
                  </a>
                </Button>
              ) : null}
              <Button variant="outline" disabled={!donationUrl} onClick={() => setShowQr(true)}>
                <QrCode className="mr-2 h-4 w-4" />
                QR code
              </Button>
              <Button
                variant="outline"
                disabled={loading || metrics.length === 0}
                onClick={() =>
                  downloadCsv(
                    `${campaignName.replace(/[^\w]+/g, "-").toLowerCase()}-campaign-groups.csv`,
                    [
                      "Group",
                      "Org group",
                      "Primary Contact",
                      "Status",
                      "Donors",
                      "Total Raised",
                      "Received",
                      "Outstanding Balance",
                    ],
                    sortedMetrics.map((row) => [
                      row.name,
                      row.organizationalGroupName || "",
                      row.leadName || "",
                      CAMPAIGN_GROUP_STATUS_LABELS[row.status],
                      row.donorCount,
                      row.groupTotal,
                      row.collected,
                      row.outstanding,
                    ])
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              {canManage ? (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Group
                </Button>
              ) : null}
            </div>
          </div>

          <StatCardsRow equal columns={4} className="shrink-0 gap-3">
            <StatCard
              fill
              className="h-full"
              tone="sky"
              icon={Users}
              label="Groups"
              value={sortedMetrics.length.toLocaleString()}
              valueClassName="text-xl"
            />
            <StatCard
              fill
              className="h-full"
              tone="amber"
              icon={Trophy}
              label="Total Raised"
              value={formatDonationCurrency(groupSummary.totalRaised)}
              valueClassName="text-xl"
            />
            <StatCard
              fill
              className="h-full"
              tone="violet"
              icon={HeartHandshake}
              label="Outstanding Balance"
              value={formatDonationCurrency(groupSummary.outstanding)}
              valueClassName="text-xl"
            />
            <StatCard
              fill
              className="h-full"
              tone="emerald"
              icon={Crown}
              label="Largest total raised"
              value={groupSummary.largest?.name || "—"}
              hint={
                groupSummary.largest
                  ? formatDonationCurrency(groupSummary.largest.groupTotal)
                  : undefined
              }
              valueClassName="text-lg leading-tight"
            />
          </StatCardsRow>

          {errorMessage ? <p className="shrink-0 text-sm text-red-600">{errorMessage}</p> : null}

          <Card className="min-h-0 flex-1 gap-0 overflow-hidden border border-border py-0 shadow-sm">
            <CardContent className="h-full min-h-0 p-0">
              <Table className="w-full table-fixed" containerClassName="h-full overflow-auto">
                <colgroup>
                  <col className="w-1/6" />
                  <col className="w-1/6" />
                  <col className="w-1/6" />
                  <col className="w-1/6" />
                  <col className="w-1/6" />
                  <col className="w-1/6" />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-card [&_th]:bg-card">
                  <TableRow>
                    <TableHead className="px-4">Group</TableHead>
                    <TableHead className="px-4">Primary Contact</TableHead>
                    <TableHead className="px-4">Donors</TableHead>
                    <TableHead className="px-4">Total Raised</TableHead>
                    <TableHead className="px-4">Received</TableHead>
                    <TableHead className="px-4">Outstanding Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Loading groups…
                      </TableCell>
                    </TableRow>
                  ) : metrics.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No campaign groups yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedMetrics.map((row) => (
                      <TableRow key={row.groupId}>
                        <TableCell className="px-4">
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() =>
                              router.replace(
                                donationCampaignWorkspaceHref(campaignId, {
                                  tab: "groups",
                                  groupId: row.groupId,
                                })
                              )
                            }
                          >
                            {row.name}
                          </button>
                        </TableCell>
                        <TableCell className="px-4">{row.leadName || "—"}</TableCell>
                        <TableCell className="px-4 tabular-nums">{row.donorCount}</TableCell>
                        <TableCell className="px-4 tabular-nums font-medium">
                          {formatDonationCurrency(row.groupTotal)}
                        </TableCell>
                        <TableCell className="px-4 tabular-nums">
                          {formatDonationCurrency(row.collected)}
                        </TableCell>
                        <TableCell className="px-4 tabular-nums">
                          {formatDonationCurrency(row.outstanding)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroupId ? "Edit Group" : "Add Group"}</DialogTitle>
            <DialogDescription>
              Create a campaign fundraising team. Optionally link an existing organizational group.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <PledgeContactPicker
              organizationId={organizationId}
              contactId={form.leadContactId}
              contactLabel={form.leadLabel}
              label="Primary Contact"
              inputId="group-lead-picker"
              onChange={(contactId, label) =>
                setForm((prev) => ({
                  ...prev,
                  leadContactId: contactId,
                  leadLabel: label,
                }))
              }
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="org-group-search">Link Existing Org Group (optional)</Label>
              <Input
                id="org-group-search"
                placeholder="Search group contacts…"
                value={orgGroupSearch || form.organizationalGroupLabel}
                onChange={(event) => {
                  setOrgGroupSearch(event.target.value)
                  setForm((prev) => ({
                    ...prev,
                    organizationalGroupId: "",
                    organizationalGroupLabel: "",
                  }))
                }}
              />
              {orgGroupResults.length > 0 ? (
                <div className="max-h-36 overflow-y-auto rounded-md border">
                  {orgGroupResults.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          organizationalGroupId: group.id,
                          organizationalGroupLabel: group.name,
                          name: prev.name || group.name,
                        }))
                        setOrgGroupSearch("")
                        setOrgGroupResults([])
                      }}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {form.organizationalGroupId ? (
                <p className="text-xs text-muted-foreground">
                  Linked: {form.organizationalGroupLabel}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value: CampaignGroupStatus) =>
                  setForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_GROUP_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CAMPAIGN_GROUP_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : editingGroupId ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code</DialogTitle>
            <DialogDescription>
              One code for every group. The donor chooses a group on the page.
            </DialogDescription>
          </DialogHeader>
          {donationUrl ? (
            <div className="flex flex-col items-center gap-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildCampaignGroupQrImageUrl(donationUrl, 280)}
                alt={`QR code for ${campaignName}`}
                className="h-64 w-64 rounded-md border border-border bg-white p-2"
              />
              <p className="break-all text-center font-mono text-xs text-muted-foreground">
                {donationUrl}
              </p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={buildCampaignGroupQrImageUrl(donationUrl, 512)}
                  download={`${campaignName.replace(/\s+/g, "-").toLowerCase()}-groups-qr.png`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download QR Code
                </a>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

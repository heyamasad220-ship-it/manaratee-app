"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Copy, ExternalLink, Plus, QrCode } from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  createCampaignGroupAction,
  deleteCampaignGroupAction,
  listCampaignGroupsAction,
  regenerateCampaignGroupLinkAction,
  searchOrganizationalGroupsAction,
  updateCampaignGroupAction,
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
  description: string
  status: CampaignGroupStatus
  leadContactId: string
  leadLabel: string
  organizationalGroupId: string
  organizationalGroupLabel: string
  publicProgressEnabled: boolean
  linkActive: boolean
}

function emptyForm(): GroupFormState {
  return {
    name: "",
    description: "",
    status: "active",
    leadContactId: "",
    leadLabel: "",
    organizationalGroupId: "",
    organizationalGroupLabel: "",
    publicProgressEnabled: false,
    linkActive: true,
  }
}

function GroupLinkIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
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
  const [qrGroupId, setQrGroupId] = useState<string | null>(null)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await listCampaignGroupsAction(campaignId)
    if (!result.success) {
      setErrorMessage(result.error)
      setMetrics([])
      setLoading(false)
      return
    }
    setMetrics(result.metrics)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

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

  const qrMetric = useMemo(
    () => metrics.find((row) => row.groupId === qrGroupId) || null,
    [metrics, qrGroupId]
  )

  function openCreate() {
    setEditingGroupId(null)
    setForm(emptyForm())
    setShowDialog(true)
  }

  function openEdit(row: CampaignGroupMetrics) {
    setEditingGroupId(row.groupId)
    setForm({
      name: row.name,
      description: row.description || "",
      status: row.status,
      leadContactId: row.leadContactId || "",
      leadLabel: row.leadName || "",
      organizationalGroupId: row.organizationalGroupId || "",
      organizationalGroupLabel: row.organizationalGroupName || "",
      publicProgressEnabled: row.publicProgressEnabled,
      linkActive: row.linkActive,
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
      description: form.description || null,
      status: form.status,
      lead_contact_id: form.leadContactId || null,
      organizational_group_id: form.organizationalGroupId || null,
      public_progress_enabled: form.publicProgressEnabled,
      link_active: form.linkActive,
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

  async function copyLink(token: string) {
    const url = buildCampaignGroupDonationUrl(token)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      prompt("Copy this donation link:", url)
    }
  }

  async function copyQrCode(row: CampaignGroupMetrics) {
    const imageUrl = buildCampaignGroupQrImageUrl(
      buildCampaignGroupDonationUrl(row.publicToken),
      512
    )
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error("Could not load QR code")
      const blob = await response.blob()
      const pngBlob = blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" })
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })])
    } catch {
      setQrGroupId(row.groupId)
    }
  }

  async function handleDeactivate(groupId: string) {
    const result = await updateCampaignGroupAction(groupId, { link_active: false })
    if (!result.success) {
      alert(result.error)
      return
    }
    await loadGroups()
    onChanged?.()
  }

  async function handleRegenerate(groupId: string) {
    if (!confirm("Regenerate this donation link? The old link will stop working.")) return
    const result = await regenerateCampaignGroupLinkAction(groupId)
    if (!result.success) {
      alert(result.error)
      return
    }
    await loadGroups()
    onChanged?.()
  }

  async function handleDelete(groupId: string) {
    if (!confirm("Delete this campaign group? Only empty groups can be deleted.")) return
    const result = await deleteCampaignGroupAction(groupId)
    if (!result.success) {
      alert(result.error)
      return
    }
    if (selectedGroupId === groupId) {
      router.replace(donationCampaignWorkspaceHref(campaignId, { tab: "groups" }))
    }
    await loadGroups()
    onChanged?.()
  }

  const donationUrlForSelected = selectedMetric
    ? buildCampaignGroupDonationUrl(selectedMetric.publicToken)
    : null

  return (
    <div className="flex flex-col gap-4">
      {selectedMetric && donationUrlForSelected ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.replace(donationCampaignWorkspaceHref(campaignId, { tab: "groups" }))
                }
              >
                Back to Groups
              </Button>
              <h2 className="mt-3 text-xl font-semibold">{selectedMetric.name}</h2>
              <p className="text-sm text-muted-foreground">{campaignName}</p>
            </div>
            {canManage ? (
              <Button variant="outline" onClick={() => openEdit(selectedMetric)}>
                Edit Group
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs uppercase text-muted-foreground">Pledged</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-xl font-semibold tabular-nums">
                {formatDonationCurrency(selectedMetric.pledged)}
              </CardContent>
            </Card>
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs uppercase text-muted-foreground">Collected</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-xl font-semibold tabular-nums">
                {formatDonationCurrency(selectedMetric.collected)}
              </CardContent>
            </Card>
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs uppercase text-muted-foreground">Donors</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-xl font-semibold tabular-nums">
                {selectedMetric.donorCount}
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Donation Link</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="break-all font-mono text-sm">{donationUrlForSelected}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyLink(selectedMetric.publicToken)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={donationUrlForSelected} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Page
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQrGroupId(selectedMetric.groupId)}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  QR Code
                </Button>
                {canManage ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRegenerate(selectedMetric.groupId)}
                    >
                      Regenerate Link
                    </Button>
                    {selectedMetric.linkActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDeactivate(selectedMetric.groupId)}
                      >
                        Deactivate Link
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void updateCampaignGroupAction(selectedMetric.groupId, {
                            link_active: true,
                          }).then(() => loadGroups())
                        }
                      >
                        Activate Link
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Link status: {selectedMetric.linkActive ? "Active" : "Inactive"}. Public donors can
                give at this URL; payments land on the same ledger with campaign + group attribution.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Group Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Lead: </span>
                {selectedMetric.leadName || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Org group: </span>
                {selectedMetric.organizationalGroupName || "Campaign-only"}
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                {CAMPAIGN_GROUP_STATUS_LABELS[selectedMetric.status]}
              </p>
              <p>
                <span className="text-muted-foreground">Outstanding: </span>
                {formatDonationCurrency(selectedMetric.outstanding)}
              </p>
              {selectedMetric.description ? (
                <p className="sm:col-span-2">{selectedMetric.description}</p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Groups</h2>
              <p className="text-sm text-muted-foreground">
                Campaign fundraising teams with unique donation links.
              </p>
            </div>
            {canManage ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Group
              </Button>
            ) : null}
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <Card className="border border-border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead className="text-right">Donors</TableHead>
                    <TableHead className="text-right">Pledged</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead>Link</TableHead>
                    {canManage ? <TableHead>Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 7 : 6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Loading groups…
                      </TableCell>
                    </TableRow>
                  ) : metrics.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 7 : 6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No campaign groups yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    metrics.map((row) => (
                      <TableRow key={row.groupId}>
                        <TableCell>
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
                        <TableCell>{row.leadName || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.donorCount}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDonationCurrency(row.pledged)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDonationCurrency(row.collected)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <GroupLinkIconButton
                              label="Copy link"
                              onClick={() => void copyLink(row.publicToken)}
                            >
                              <Copy className="h-4 w-4" />
                            </GroupLinkIconButton>
                            <GroupLinkIconButton
                              label="Copy QR code"
                              onClick={() => void copyQrCode(row)}
                            >
                              <QrCode className="h-4 w-4" />
                            </GroupLinkIconButton>
                          </div>
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => void handleDelete(row.groupId)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
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
              label="Group Lead"
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="group-description">Public Description</Label>
              <Textarea
                id="group-description"
                rows={2}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Show public progress</p>
                <p className="text-xs text-muted-foreground">
                  When enabled, the public donation page may show group progress.
                </p>
              </div>
              <Switch
                checked={form.publicProgressEnabled}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, publicProgressEnabled: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Donation link active</p>
              </div>
              <Switch
                checked={form.linkActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, linkActive: checked }))
                }
              />
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

      <Dialog open={Boolean(qrMetric)} onOpenChange={(open) => !open && setQrGroupId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code</DialogTitle>
            <DialogDescription>
              {qrMetric?.name} — scans open the group donation link.
            </DialogDescription>
          </DialogHeader>
          {qrMetric ? (
            <div className="flex flex-col items-center gap-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildCampaignGroupQrImageUrl(
                  buildCampaignGroupDonationUrl(qrMetric.publicToken),
                  280
                )}
                alt={`QR code for ${qrMetric.name}`}
                className="h-64 w-64 rounded-md border border-border bg-white p-2"
              />
              <Button variant="outline" size="sm" asChild>
                <a
                  href={buildCampaignGroupQrImageUrl(
                    buildCampaignGroupDonationUrl(qrMetric.publicToken),
                    512
                  )}
                  download={`${qrMetric.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
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

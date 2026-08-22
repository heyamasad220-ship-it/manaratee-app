"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"

import { CampaignProspectRecordPledgeDialog } from "@/components/donations/campaign-prospect-record-pledge-dialog"
import { CampaignProspectStageBadge } from "@/components/donations/campaign-prospect-stage-badge"
import { PledgeContactPicker } from "@/components/donations/pledge-contact-picker"
import { QuickAddContactDialog } from "@/components/contacts/quick-add-contact-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import type { CampaignAskLevelRow } from "@/lib/donations/campaign-ask-level-types"
import {
  bulkAssignCampaignProspectsAction,
  createCampaignProspectAction,
  deleteCampaignProspectAction,
  fetchCampaignProspectsPageAction,
  listCampaignProspectAssigneesAction,
  updateCampaignProspectAction,
} from "@/lib/donations/campaign-prospect-actions"
import {
  CAMPAIGN_PROSPECT_STAGE_LABELS,
  campaignProspectStagesForSelect,
  displayCampaignProspectStage,
  isProspectFollowUpOverdue,
  type CampaignProspectListItem,
  type CampaignProspectStage,
} from "@/lib/donations/campaign-prospect-types"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { cn } from "@/lib/utils"

const ALL = "all"
const NO_ASK_LEVEL = "__none__"
const UNASSIGNED = "__unassigned__"
const ASSIGNED = "__assigned__"

function initialAssigneeFilter(value: string | null) {
  if (!value) return ALL
  if (value === "unassigned") return UNASSIGNED
  return value
}

type CampaignProspectsTabProps = {
  campaignId: string
  organizationId: string
  askLevels: CampaignAskLevelRow[]
  canManage: boolean
  onChanged: () => void
  initialFollowUp?: "overdue" | "upcoming" | null
  initialAssignee?: string | null
  initialStage?: string | null
  initialPledged?: "pledged" | "not_pledged" | null
}

type ProspectFormState = {
  contactId: string
  contactLabel: string
  askLevelId: string
  suggestedAskAmount: string
  assignedToContactId: string
  assignedToLabel: string
  stage: CampaignProspectStage
  lastContactedAt: string
  nextFollowUpAt: string
  notes: string
}

function emptyForm(askLevels: CampaignAskLevelRow[]): ProspectFormState {
  const firstAsk = askLevels[0]
  return {
    contactId: "",
    contactLabel: "",
    askLevelId: firstAsk?.id || "",
    suggestedAskAmount: firstAsk ? String(firstAsk.ask_amount) : "",
    assignedToContactId: "",
    assignedToLabel: "",
    stage: "identified",
    lastContactedAt: "",
    nextFollowUpAt: "",
    notes: "",
  }
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function CampaignProspectsTab({
  campaignId,
  organizationId,
  askLevels,
  canManage,
  onChanged,
  initialFollowUp = null,
  initialAssignee = null,
  initialStage = null,
  initialPledged = null,
}: CampaignProspectsTabProps) {
  const [prospects, setProspects] = useState<CampaignProspectListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [stageFilter, setStageFilter] = useState(initialStage || ALL)
  const [followUpFilter] = useState(initialFollowUp || ALL)
  const [pledgedFilter] = useState(initialPledged || ALL)
  const [assigneeFilter, setAssigneeFilter] = useState(initialAssigneeFilter(initialAssignee))
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<CampaignProspectListItem | null>(null)
  const [form, setForm] = useState<ProspectFormState>(() => emptyForm(askLevels))
  const [saving, setSaving] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [bulkAssigneeId, setBulkAssigneeId] = useState("")
  const [bulkAssigneeLabel, setBulkAssigneeLabel] = useState("")
  const [convertProspectId, setConvertProspectId] = useState<string | null>(null)
  const [showConvertDialog, setShowConvertDialog] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadProspects = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await fetchCampaignProspectsPageAction({
      campaignId,
      page,
      pageSize: DONATIONS_PAGE_SIZE,
      search: debouncedSearch || undefined,
      stage: stageFilter === ALL ? null : stageFilter,
      followUp:
        followUpFilter === "overdue" || followUpFilter === "upcoming"
          ? followUpFilter
          : null,
      pledged:
        pledgedFilter === "pledged" || pledgedFilter === "not_pledged"
          ? pledgedFilter
          : null,
      assignedToContactId: assigneeFilter === ALL ? null : assigneeFilter,
      sortBy: "next_follow_up",
      sortAsc: true,
    })

    if (!result.success) {
      setErrorMessage(result.error)
      setProspects([])
      setTotal(0)
      setLoading(false)
      return
    }

    setProspects(result.prospects)
    setTotal(result.total)
    setLoading(false)
  }, [
    campaignId,
    page,
    debouncedSearch,
    stageFilter,
    followUpFilter,
    pledgedFilter,
    assigneeFilter,
  ])

  const loadAssignees = useCallback(async () => {
    const result = await listCampaignProspectAssigneesAction(campaignId)
    if (result.success) setAssignees(result.assignees)
  }, [campaignId])

  useEffect(() => {
    void loadProspects()
  }, [loadProspects])

  useEffect(() => {
    void loadAssignees()
  }, [loadAssignees])

  useEffect(() => {
    setPage(1)
    setSelectedIds([])
  }, [debouncedSearch, stageFilter, followUpFilter, pledgedFilter, assigneeFilter])

  const totalPages = Math.max(1, Math.ceil(total / DONATIONS_PAGE_SIZE))

  const askLevelOptions = useMemo(
    () =>
      [...askLevels].sort(
        (a, b) => a.sort_order - b.sort_order || b.ask_amount - a.ask_amount
      ),
    [askLevels]
  )

  function openCreate() {
    setEditing(null)
    setForm(emptyForm(askLevels))
    setShowDialog(true)
  }

  function openEdit(prospect: CampaignProspectListItem) {
    setEditing(prospect)
    setForm({
      contactId: prospect.contact_id,
      contactLabel: prospect.contactName,
      askLevelId: prospect.ask_level_id || "",
      suggestedAskAmount:
        prospect.suggested_ask_amount != null ? String(prospect.suggested_ask_amount) : "",
      assignedToContactId: prospect.assigned_to_contact_id || "",
      assignedToLabel: prospect.assignedToName || "",
      stage: displayCampaignProspectStage(prospect.stage),
      lastContactedAt: prospect.last_contacted_at || "",
      nextFollowUpAt: prospect.next_follow_up_at || "",
      notes: prospect.notes || "",
    })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.contactId) {
      alert("Select a contact for this prospect")
      return
    }

    setSaving(true)
    const payload = {
      contact_id: form.contactId,
      ask_level_id: form.askLevelId || null,
      suggested_ask_amount: form.suggestedAskAmount
        ? Number(form.suggestedAskAmount)
        : null,
      assigned_to_contact_id: form.assignedToContactId || null,
      stage: form.stage,
      last_contacted_at: form.lastContactedAt || null,
      next_follow_up_at: form.nextFollowUpAt || null,
      notes: form.notes || null,
    }

    const result = editing
      ? await updateCampaignProspectAction(editing.id, payload)
      : await createCampaignProspectAction(campaignId, payload)

    setSaving(false)

    if (!result.success) {
      alert(result.error)
      return
    }

    setShowDialog(false)
    await loadProspects()
    await loadAssignees()
    onChanged()
  }

  async function handleDelete(prospect: CampaignProspectListItem) {
    if (!confirm(`Remove ${prospect.contactName} from this campaign’s prospects?`)) return
    const result = await deleteCampaignProspectAction(prospect.id)
    if (!result.success) {
      alert(result.error)
      return
    }
    setShowDialog(false)
    setEditing(null)
    await loadProspects()
    await loadAssignees()
    onChanged()
  }

  async function handleBulkAssign() {
    if (selectedIds.length === 0) {
      alert("Select at least one prospect")
      return
    }
    const result = await bulkAssignCampaignProspectsAction({
      prospectIds: selectedIds,
      assignedToContactId: bulkAssigneeId || null,
    })
    if (!result.success) {
      alert(result.error)
      return
    }
    setSelectedIds([])
    setBulkAssigneeId("")
    setBulkAssigneeLabel("")
    await loadProspects()
    await loadAssignees()
    onChanged()
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((value) => value !== id)
    )
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? prospects.map((row) => row.id) : [])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Prospects</h2>
          <p className="text-sm text-muted-foreground">
            People you plan to ask — not pledges. Link each prospect to an existing Contact.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowQuickAdd(true)}>
              New Contact
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Donor
            </Button>
          </div>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search prospect, assignee, notes…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {canManage && selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium">{selectedIds.length} selected</p>
          <div className="min-w-[220px] flex-1">
            <PledgeContactPicker
              organizationId={organizationId}
              contactId={bulkAssigneeId}
              contactLabel={bulkAssigneeLabel}
              label="Assign selected to"
              inputId="bulk-assignee-picker"
              onChange={(contactId, label) => {
                setBulkAssigneeId(contactId)
                setBulkAssigneeLabel(label)
              }}
            />
          </div>
          <Button onClick={() => void handleBulkAssign()}>Bulk Assign</Button>
        </div>
      ) : null}

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        prospects.length > 0 && selectedIds.length === prospects.length
                      }
                      onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      aria-label="Select all prospects"
                    />
                  </TableHead>
                ) : null}
                <TableHead>Prospect</TableHead>
                <TableHead className="text-right">Suggested Ask</TableHead>
                <TableHead>
                  <TableColumnHeaderFilter
                    label="Assigned"
                    active={assigneeFilter !== ALL}
                  >
                    {({ close }) => {
                      const assignedMode =
                        assigneeFilter === UNASSIGNED
                          ? UNASSIGNED
                          : assigneeFilter === ALL
                            ? ALL
                            : ASSIGNED
                      return (
                        <div className="flex flex-col gap-2">
                          <Select
                            value={assignedMode}
                            onValueChange={(value) => {
                              setAssigneeFilter(value)
                              if (value !== ASSIGNED) close()
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Assigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL}>All</SelectItem>
                              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                              <SelectItem value={ASSIGNED}>Assigned</SelectItem>
                            </SelectContent>
                          </Select>
                          {assignedMode === ASSIGNED ? (
                            <Select
                              value={
                                assigneeFilter === ASSIGNED ? ASSIGNED : assigneeFilter
                              }
                              onValueChange={(value) => {
                                setAssigneeFilter(value)
                                close()
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Assigned person" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={ASSIGNED}>All assigned</SelectItem>
                                {assignees.map((assignee) => (
                                  <SelectItem key={assignee.id} value={assignee.id}>
                                    {assignee.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </div>
                      )
                    }}
                  </TableColumnHeaderFilter>
                </TableHead>
                <TableHead>
                  <TableColumnHeaderFilter label="Stage" active={stageFilter !== ALL}>
                    {({ close }) => (
                      <Select
                        value={stageFilter}
                        onValueChange={(value) => {
                          setStageFilter(value)
                          close()
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Stage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All</SelectItem>
                          {campaignProspectStagesForSelect(stageFilter).map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {CAMPAIGN_PROSPECT_STAGE_LABELS[stage]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableColumnHeaderFilter>
                </TableHead>
                <TableHead>Last Contact</TableHead>
                <TableHead>Next Follow-up</TableHead>
                <TableHead className="text-right">Actual Pledge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                        colSpan={canManage ? 8 : 7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading prospects…
                  </TableCell>
                </TableRow>
              ) : prospects.length === 0 ? (
                <TableRow>
                  <TableCell
                        colSpan={canManage ? 8 : 7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No prospects match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                prospects.map((prospect) => {
                  const overdue = isProspectFollowUpOverdue(
                    prospect.next_follow_up_at,
                    prospect.stage
                  )
                  return (
                    <TableRow
                      key={prospect.id}
                      className={cn(
                        overdue && "bg-amber-50/80 dark:bg-amber-950/20",
                        canManage && "cursor-pointer"
                      )}
                      onClick={canManage ? () => openEdit(prospect) : undefined}
                    >
                      {canManage ? (
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(prospect.id)}
                            onCheckedChange={(checked) =>
                              toggleSelected(prospect.id, Boolean(checked))
                            }
                            aria-label={`Select ${prospect.contactName}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="font-medium">{prospect.contactName}</div>
                        {prospect.contactEmail ? (
                          <div className="text-xs text-muted-foreground">
                            {prospect.contactEmail}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {prospect.suggested_ask_amount != null
                          ? formatDonationCurrency(prospect.suggested_ask_amount)
                          : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {prospect.assignedToName || (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <CampaignProspectStageBadge stage={prospect.stage} />
                      </TableCell>
                      <TableCell>{formatShortDate(prospect.last_contacted_at)}</TableCell>
                      <TableCell
                        className={cn(overdue && "font-medium text-amber-800 dark:text-amber-200")}
                      >
                        {formatShortDate(prospect.next_follow_up_at)}
                        {overdue ? (
                          <span className="ml-1 text-xs uppercase">Overdue</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {prospect.pledgeAmount != null
                          ? formatDonationCurrency(prospect.pledgeAmount)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {total} prospects
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Donor</DialogTitle>
            <DialogDescription>
              Link a Contact, set the suggested ask, and assign outreach ownership.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <PledgeContactPicker
              organizationId={organizationId}
              contactId={form.contactId}
              contactLabel={form.contactLabel}
              label="Prospect Contact"
              inputId="prospect-contact-picker"
              onChange={(contactId, label) =>
                setForm((prev) => ({ ...prev, contactId, contactLabel: label }))
              }
            />
            <Button
              type="button"
              variant="link"
              className="h-auto justify-start px-0"
              onClick={() => setShowQuickAdd(true)}
            >
              Contact not found? Create one
            </Button>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Ask Level</Label>
                <Select
                  value={form.askLevelId || NO_ASK_LEVEL}
                  onValueChange={(value) => {
                    const askLevelId = value === NO_ASK_LEVEL ? "" : value
                    const level = askLevels.find((row) => row.id === askLevelId)
                    setForm((prev) => ({
                      ...prev,
                      askLevelId,
                      suggestedAskAmount: level
                        ? String(level.ask_amount)
                        : prev.suggestedAskAmount,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ASK_LEVEL}>No ask level</SelectItem>
                    {askLevelOptions.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {formatDonationCurrency(level.ask_amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="suggested-ask">Suggested Ask Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="suggested-ask"
                    type="number"
                    className="pl-7"
                    value={form.suggestedAskAmount}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        suggestedAskAmount: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <PledgeContactPicker
                organizationId={organizationId}
                contactId={form.assignedToContactId}
                contactLabel={form.assignedToLabel}
                label="Assigned To"
                inputId="prospect-assignee-picker"
                onChange={(contactId, label) =>
                  setForm((prev) => ({
                    ...prev,
                    assignedToContactId: contactId,
                    assignedToLabel: label,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Stage</Label>
              <Select
                value={form.stage}
                onValueChange={(value: CampaignProspectStage) =>
                  setForm((prev) => ({ ...prev, stage: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campaignProspectStagesForSelect(form.stage).map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {CAMPAIGN_PROSPECT_STAGE_LABELS[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="last-contact">Last Contact Date</Label>
                <Input
                  id="last-contact"
                  type="date"
                  value={form.lastContactedAt}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, lastContactedAt: event.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="next-follow-up">Next Follow-up Date</Label>
                <Input
                  id="next-follow-up"
                  type="date"
                  value={form.nextFollowUpAt}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, nextFollowUpAt: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="prospect-notes">Notes</Label>
              <Textarea
                id="prospect-notes"
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-col sm:space-x-0">
            {editing ? (
              <div className="flex w-full flex-wrap gap-2">
                {editing.stage !== "pledged" && !editing.converted_pledge_id ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      setShowDialog(false)
                      setConvertProspectId(editing.id)
                      setShowConvertDialog(true)
                    }}
                  >
                    Record Pledge
                  </Button>
                ) : editing.converted_pledge_id ? (
                  <Button type="button" variant="outline" asChild>
                    <Link
                      href={donationPledgesHref({
                        pledgeId: editing.converted_pledge_id,
                        action: "view",
                      })}
                    >
                      View Pledge
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Assign Donor"}
              </Button>
            </div>
            {editing && !editing.converted_pledge_id ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={saving}
                onClick={() => void handleDelete(editing)}
              >
                Delete
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddContactDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onCreated={(contact) => {
          setForm((prev) => ({
            ...prev,
            contactId: contact.contactId,
            contactLabel: contact.full_name || contact.email || "New contact",
          }))
          setShowDialog(true)
        }}
      />

      <CampaignProspectRecordPledgeDialog
        open={showConvertDialog}
        onOpenChange={(open) => {
          setShowConvertDialog(open)
          if (!open) setConvertProspectId(null)
        }}
        prospectId={convertProspectId}
        organizationId={organizationId}
        onConverted={() => {
          void loadProspects()
          void loadAssignees()
          onChanged()
        }}
      />
    </div>
  )
}

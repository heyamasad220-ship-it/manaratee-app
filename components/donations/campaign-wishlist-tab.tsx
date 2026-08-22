"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, ExternalLink, Gift, Plus, QrCode } from "lucide-react"

import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  archiveCampaignWishlistItemAction,
  carryForwardWishlistItemAction,
  createCampaignWishlistItemAction,
  getWishlistItemDetailAction,
  listCampaignWishlistItemsAction,
  listOrgCampaignsForCarryForwardAction,
  updateCampaignWishlistItemAction,
} from "@/lib/donations/campaign-wishlist-actions"
import {
  WISHLIST_FUNDING_STATUS_LABELS,
  WISHLIST_ITEM_TYPE_LABELS,
  WISHLIST_ITEM_TYPES,
  WISHLIST_PRIORITIES,
  WISHLIST_PRIORITY_LABELS,
  WISHLIST_PROJECT_STATUS_LABELS,
  WISHLIST_PROJECT_STATUSES,
  type CampaignWishlistItemMetric,
  type CampaignWishlistWriteInput,
  type WishlistFundingStatus,
  type WishlistItemType,
  type WishlistPriority,
  type WishlistProjectStatus,
} from "@/lib/donations/campaign-wishlist-types"
import {
  buildWishlistDonationUrl,
  buildWishlistQrImageUrl,
} from "@/lib/donations/campaign-wishlist-urls"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type CampaignWishlistTabProps = {
  campaignId: string
  organizationId: string
  canManage: boolean
}

type FormState = CampaignWishlistWriteInput

const EMPTY_FORM: FormState = {
  name: "",
  item_type: "other",
  description: "",
  target_amount: 0,
  priority: "medium",
  project_status: "planned",
  target_completion_date: "",
  actual_completion_date: "",
  completion_notes: "",
  fund_id: null,
  department_id: null,
  campaign_phase_id: null,
  public_visible: false,
  link_active: true,
  carry_forward_enabled: false,
  notes: "",
  image_url: "",
}

function fundingBadgeClass(status: WishlistFundingStatus) {
  if (status === "fully_funded") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (status === "overfunded") return "border-blue-200 bg-blue-50 text-blue-800"
  if (status === "partially_funded") return "border-amber-200 bg-amber-50 text-amber-800"
  return "border-border text-muted-foreground"
}

const PRIORITY_SORT_RANK: Record<WishlistPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function CampaignWishlistTab({
  campaignId,
  organizationId,
  canManage,
}: CampaignWishlistTabProps) {
  const supabase = createClient()
  const [items, setItems] = useState<CampaignWishlistItemMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    item: CampaignWishlistItemMetric
    pledges: Array<Record<string, unknown>>
    payments: Array<Record<string, unknown>>
  } | null>(null)

  const [carryItemId, setCarryItemId] = useState<string | null>(null)
  const [destinationCampaignId, setDestinationCampaignId] = useState("")
  const [campaignOptions, setCampaignOptions] = useState<Array<{ id: string; name: string }>>([])

  const [qrToken, setQrToken] = useState<string | null>(null)
  const [funds, setFunds] = useState<Array<{ id: string; name: string }>>([])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await listCampaignWishlistItemsAction(campaignId)
    if (!result.success) {
      setErrorMessage(result.error)
      setItems([])
      setLoading(false)
      return
    }
    setItems(result.items)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      const [fundsResult, departmentsResult] = await Promise.all([
        supabase
          .from("donation_subcategories")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name"),
        supabase
          .from("departments")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name"),
      ])
      setFunds((fundsResult.data || []).map((row) => ({ id: row.id as string, name: String(row.name) })))
      setDepartments(
        (departmentsResult.data || []).map((row) => ({ id: row.id as string, name: String(row.name) }))
      )
    })()
  }, [campaignId, organizationId, supabase])

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const rankDiff = PRIORITY_SORT_RANK[a.priority] - PRIORITY_SORT_RANK[b.priority]
      if (rankDiff !== 0) return rankDiff
      return a.name.localeCompare(b.name)
    })
  }, [items])

  const summary = useMemo(() => {
    return {
      count: items.length,
      target: items.reduce((sum, item) => sum + item.target_amount, 0),
      pledged: items.reduce((sum, item) => sum + item.pledged, 0),
      collected: items.reduce((sum, item) => sum + item.collected, 0),
      remaining: items.reduce((sum, item) => sum + item.remaining, 0),
      completed: items.filter((item) => item.project_status === "completed").length,
    }
  }, [items])

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, sort_order: items.length })
    setShowForm(true)
  }

  function openEdit(item: CampaignWishlistItemMetric) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      item_type: item.item_type,
      description: item.description || "",
      target_amount: item.target_amount,
      priority: item.priority,
      project_status: item.project_status,
      target_completion_date: item.target_completion_date || "",
      actual_completion_date: item.actual_completion_date || "",
      completion_notes: item.completion_notes || "",
      fund_id: item.fund_id,
      department_id: item.department_id,
      public_visible: item.public_visible,
      link_active: item.link_active,
      carry_forward_enabled: item.carry_forward_enabled,
      notes: item.notes || "",
      image_url: item.image_url || "",
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload: CampaignWishlistWriteInput = {
      ...form,
      target_amount: Number(form.target_amount || 0),
      fund_id: form.fund_id || null,
      department_id: form.department_id || null,
      campaign_phase_id: null,
    }
    const result = editingId
      ? await updateCampaignWishlistItemAction(editingId, payload)
      : await createCampaignWishlistItemAction(campaignId, payload)
    setSaving(false)
    if (!result.success) {
      alert(result.error)
      return
    }
    setShowForm(false)
    await load()
  }

  async function openDetail(itemId: string) {
    setDetailId(itemId)
    const result = await getWishlistItemDetailAction(itemId)
    if (!result.success) {
      alert(result.error)
      setDetailId(null)
      return
    }
    setDetail({ item: result.item, pledges: result.pledges, payments: result.payments })
  }

  async function handleCarryForward() {
    if (!carryItemId || !destinationCampaignId) return
    setSaving(true)
    const result = await carryForwardWishlistItemAction({
      itemId: carryItemId,
      destinationCampaignId,
    })
    setSaving(false)
    if (!result.success) {
      alert(result.error)
      return
    }
    setCarryItemId(null)
    await load()
  }

  const qrItem = items.find((item) => item.public_token === qrToken) || null

  return (
    <div className="flex flex-col gap-6">
      <DonationMetricCardGrid colorful columns={4}>
        <DonationMetricCard title="Wishlist Items" value={summary.count} icon={Gift} accent="blue" />
        <DonationMetricCard
          title="Total Target"
          value={formatDonationCurrency(summary.target)}
          icon={Gift}
          accent="purple"
          description="Sub-goals — not added to campaign goal"
        />
        <DonationMetricCard
          title="Collected"
          value={formatDonationCurrency(summary.collected)}
          icon={Gift}
          accent="emerald"
          description={`${formatDonationCurrency(summary.pledged)} pledged`}
        />
        <DonationMetricCard
          title="Remaining Need"
          value={formatDonationCurrency(summary.remaining)}
          icon={Gift}
          accent="amber"
          description={`${summary.completed} completed`}
        />
      </DonationMetricCardGrid>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Wishlist</h2>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Wishlist Item
          </Button>
        ) : null}
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading wishlist...</p>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="text-sm text-muted-foreground">No wishlist items yet.</p>
              <p className="text-sm text-muted-foreground">
                Add specific funding priorities for this campaign.
              </p>
              {canManage ? (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Wishlist Item
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Pledged</TableHead>
                    <TableHead>Collected</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Funding</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Public</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => void openDetail(item.id)}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{WISHLIST_ITEM_TYPE_LABELS[item.item_type]}</TableCell>
                      <TableCell>{formatDonationCurrency(item.target_amount)}</TableCell>
                      <TableCell>{formatDonationCurrency(item.pledged)}</TableCell>
                      <TableCell>{formatDonationCurrency(item.collected)}</TableCell>
                      <TableCell>{formatDonationCurrency(item.remaining)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("whitespace-nowrap", fundingBadgeClass(item.fundingStatus))}>
                          {WISHLIST_FUNDING_STATUS_LABELS[item.fundingStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{WISHLIST_PROJECT_STATUS_LABELS[item.project_status]}</Badge>
                      </TableCell>
                      <TableCell>{WISHLIST_PRIORITY_LABELS[item.priority]}</TableCell>
                      <TableCell>{item.public_visible ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {item.public_visible ? (
                            <Button variant="ghost" size="sm" onClick={() => setQrToken(item.public_token)}>
                              Donation Link
                            </Button>
                          ) : null}
                          {canManage ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>Edit</Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  setCarryItemId(item.id)
                                  const result = await listOrgCampaignsForCarryForwardAction(campaignId)
                                  if (result.success) {
                                    setCampaignOptions(result.campaigns)
                                    setDestinationCampaignId(result.campaigns[0]?.id || "")
                                  }
                                }}
                              >
                                Carry Forward
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Wishlist Item" : "Add Wishlist Item"}</DialogTitle>
            <DialogDescription>
              A wishlist item is a campaign priority. It is not a fund and does not raise the campaign goal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label>Item Name</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label>Target Amount</Label>
              <Input
                type="number"
                min="0"
                value={form.target_amount}
                onChange={(event) => setForm({ ...form, target_amount: Number(event.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Type</Label>
                <Select value={String(form.item_type)} onValueChange={(value) => setForm({ ...form, item_type: value as WishlistItemType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WISHLIST_ITEM_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{WISHLIST_ITEM_TYPE_LABELS[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Priority</Label>
                <Select value={String(form.priority)} onValueChange={(value) => setForm({ ...form, priority: value as WishlistPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WISHLIST_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>{WISHLIST_PRIORITY_LABELS[priority]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1">
              <Label>Description</Label>
              <Textarea value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label>Project Status</Label>
              <Select value={String(form.project_status)} onValueChange={(value) => setForm({ ...form, project_status: value as WishlistProjectStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WISHLIST_PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{WISHLIST_PROJECT_STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Target Completion</Label>
                <Input type="date" value={form.target_completion_date || ""} onChange={(event) => setForm({ ...form, target_completion_date: event.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Actual Completion</Label>
                <Input type="date" value={form.actual_completion_date || ""} onChange={(event) => setForm({ ...form, actual_completion_date: event.target.value })} />
              </div>
            </div>
            {form.project_status === "completed" ? (
              <div className="grid gap-1">
                <Label>Completion Notes</Label>
                <Textarea value={form.completion_notes || ""} onChange={(event) => setForm({ ...form, completion_notes: event.target.value })} />
              </div>
            ) : null}
            <div className="grid gap-1">
              <Label>Fund (optional)</Label>
              <Select value={form.fund_id || "none"} onValueChange={(value) => setForm({ ...form, fund_id: value === "none" ? null : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No fund</SelectItem>
                  {funds.map((fund) => (
                    <SelectItem key={fund.id} value={fund.id}>{fund.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Department (optional)</Label>
              <Select value={form.department_id || "none"} onValueChange={(value) => setForm({ ...form, department_id: value === "none" ? null : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Show on public wishlist</p>
                <p className="text-xs text-muted-foreground">Private items stay staff-only.</p>
              </div>
              <Switch checked={Boolean(form.public_visible)} onCheckedChange={(checked) => setForm({ ...form, public_visible: checked })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Carry forward to next campaign</p>
                <p className="text-xs text-muted-foreground">Marks this item as eligible; carry still requires an admin action.</p>
              </div>
              <Switch checked={Boolean(form.carry_forward_enabled)} onCheckedChange={(checked) => setForm({ ...form, carry_forward_enabled: checked })} />
            </div>
            <div className="grid gap-1">
              <Label>Notes</Label>
              <Textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            {editingId ? (
              <Button
                variant="outline"
                className="mr-auto"
                onClick={async () => {
                  if (!confirm("Archive this wishlist item? Pledges and payments stay in history.")) return
                  const result = await archiveCampaignWishlistItemAction(editingId)
                  if (!result.success) {
                    alert(result.error)
                    return
                  }
                  setShowForm(false)
                  await load()
                }}
              >
                Archive
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailId)} onOpenChange={(open) => !open && (setDetailId(null), setDetail(null))}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.item.name || "Wishlist item"}</DialogTitle>
            <DialogDescription>
              {detail?.item.campaignName || "Campaign"} — funding status is calculated from attributed pledges and payments.
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-4">
              {detail.item.previousFunding > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Previously funded {formatDonationCurrency(detail.item.previousFunding)}. Current campaign collected{" "}
                  {formatDonationCurrency(detail.item.collected)}. Lifetime {formatDonationCurrency(detail.item.lifetimeCollected)}.
                </p>
              ) : null}
              <CampaignProgressBar progressPercent={detail.item.fundingPercent} />
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>Target {formatDonationCurrency(detail.item.target_amount)}</div>
                <div>Pledged {formatDonationCurrency(detail.item.pledged)}</div>
                <div>Collected {formatDonationCurrency(detail.item.collected)}</div>
                <div>Remaining {formatDonationCurrency(detail.item.remaining)}</div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Giving activity</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.pledges.map((pledge) => (
                      <TableRow key={`pledge-${pledge.id}`}>
                        <TableCell>{String(pledge.donor_name || "Donor")}</TableCell>
                        <TableCell>Pledge</TableCell>
                        <TableCell>{formatDonationCurrency(Number(pledge.amount_pledged || 0))}</TableCell>
                        <TableCell>{formatDonationCurrency(Number(pledge.amount_paid || 0))}</TableCell>
                        <TableCell>{formatDonationCurrency(Number(pledge.balance_remaining || 0))}</TableCell>
                      </TableRow>
                    ))}
                    {detail.payments.map((payment) => (
                      <TableRow key={`pay-${payment.id}`}>
                        <TableCell>{String(payment.sender_name || "Donor")}</TableCell>
                        <TableCell>Payment</TableCell>
                        <TableCell>{formatDonationCurrency(Number(payment.amount || 0))}</TableCell>
                        <TableCell>{formatDonationCurrency(Number(payment.amount || 0))}</TableCell>
                        <TableCell>—</TableCell>
                      </TableRow>
                    ))}
                    {detail.pledges.length === 0 && detail.payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">No attributed gifts yet.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(carryItemId)} onOpenChange={(open) => !open && setCarryItemId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carry Forward</DialogTitle>
            <DialogDescription>
              Creates a new item in the destination campaign. Prior gifts stay on the original campaign and are not counted as new money.
            </DialogDescription>
          </DialogHeader>
          <Select value={destinationCampaignId} onValueChange={setDestinationCampaignId}>
            <SelectTrigger><SelectValue placeholder="Destination campaign" /></SelectTrigger>
            <SelectContent>
              {campaignOptions.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCarryItemId(null)}>Cancel</Button>
            <Button onClick={() => void handleCarryForward()} disabled={saving || !destinationCampaignId}>
              Carry Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(qrItem)} onOpenChange={(open) => !open && setQrToken(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Donation Link</DialogTitle>
            <DialogDescription>{qrItem?.name}</DialogDescription>
          </DialogHeader>
          {qrItem ? (
            <div className="flex flex-col items-center gap-3">
              <p className="break-all font-mono text-xs">{buildWishlistDonationUrl(qrItem.public_token)}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildWishlistQrImageUrl(buildWishlistDonationUrl(qrItem.public_token), 280)}
                alt={`QR for ${qrItem.name}`}
                className="h-64 w-64 rounded-md border bg-white p-2"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(buildWishlistDonationUrl(qrItem.public_token))}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={buildWishlistDonationUrl(qrItem.public_token)} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Page
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={buildWishlistQrImageUrl(buildWishlistDonationUrl(qrItem.public_token), 512)}
                    download={`${qrItem.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Download QR
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

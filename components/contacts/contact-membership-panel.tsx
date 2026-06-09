"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, UserCheck } from "lucide-react"
import {
  createMembership,
  lapseMembership,
  updateMembership,
} from "@/lib/memberships/membership-actions"
import {
  fetchContactMemberships,
  fetchMembershipTypes,
  type MembershipRecord,
  type MembershipType,
} from "@/lib/memberships/membership-queries"
import {
  MEMBERSHIP_STATUSES,
  MEMBERSHIP_STATUS_COLORS,
  formatMembershipStatus,
  type MembershipStatus,
} from "@/lib/memberships/membership-constants"
import { MEMBERSHIP_MEMBERS_PATH } from "@/lib/memberships/membership-module-label"
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
import { Textarea } from "@/components/ui/textarea"
import { ContactTeamsPanel } from "@/components/contacts/contact-teams-panel"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"

type ContactMembershipPanelProps = {
  contactId: string
  contactName: string
  teamsCount: number
  onMembershipChanged?: () => void
}

type MembershipFormState = {
  membershipTypeId: string
  status: MembershipStatus
  startDate: string
  endDate: string
  renewalDate: string
  notes: string
}

function emptyForm(): MembershipFormState {
  return {
    membershipTypeId: "",
    status: "active",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    renewalDate: "",
    notes: "",
  }
}

function toFormState(record?: MembershipRecord | null): MembershipFormState {
  if (!record) return emptyForm()
  return {
    membershipTypeId: record.membership_type_id || "",
    status: record.status,
    startDate: record.start_date,
    endDate: record.end_date || "",
    renewalDate: record.renewal_date || "",
    notes: record.notes || "",
  }
}

function typeName(record: MembershipRecord) {
  const rel = record.membership_type
  if (!rel) return "—"
  if (Array.isArray(rel)) return rel[0]?.name || "—"
  return rel.name || "—"
}

export function ContactMembershipPanel({
  contactId,
  contactName,
  teamsCount,
  onMembershipChanged,
}: ContactMembershipPanelProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [memberships, setMemberships] = useState<MembershipRecord[]>([])
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMembership, setEditingMembership] = useState<MembershipRecord | null>(null)
  const [form, setForm] = useState<MembershipFormState>(emptyForm())

  const activeMembership = useMemo(
    () => memberships.find((row) => row.status === "active") ?? null,
    [memberships]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [records, types] = await Promise.all([
        fetchContactMemberships(contactId),
        fetchMembershipTypes(),
      ])
      setMemberships(records)
      setMembershipTypes(types)
    } catch (error) {
      console.error("Error loading memberships:", error)
      setMemberships([])
      setMembershipTypes([])
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function openCreateDialog() {
    setEditingMembership(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEditDialog(record: MembershipRecord) {
    setEditingMembership(record)
    setForm(toFormState(record))
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        membershipTypeId: form.membershipTypeId || null,
        status: form.status,
        startDate: form.startDate,
        endDate: form.endDate || null,
        renewalDate: form.renewalDate || null,
        notes: form.notes || null,
      }

      if (editingMembership) {
        await updateMembership({
          id: editingMembership.id,
          ...payload,
        })
      } else {
        await createMembership({
          contactId,
          ...payload,
        })
      }

      setDialogOpen(false)
      await loadData()
      onMembershipChanged?.()
      router.refresh()
    } catch (error: any) {
      alert(error?.message || "Could not save membership")
    } finally {
      setSaving(false)
    }
  }

  async function handleLapse(record: MembershipRecord) {
    if (!window.confirm(`Mark ${contactName}'s membership as lapsed?`)) return
    setSaving(true)
    try {
      await lapseMembership(record.id)
      await loadData()
      onMembershipChanged?.()
      router.refresh()
    } catch (error: any) {
      alert(error?.message || "Could not lapse membership")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCheck className="size-5 text-indigo-600" />
              <h2 className="text-lg font-semibold">Membership</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={MEMBERSHIP_MEMBERS_PATH}>View all members</Link>
              </Button>
              {!activeMembership ? (
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add membership
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => openEditDialog(activeMembership)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            MAS membership grants member benefits (discounts, member-only events). Optional team
            assignments are managed below — not every member belongs to a team.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading membership...
            </div>
          ) : activeMembership ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge
                  variant="secondary"
                  className={`mt-1 ${MEMBERSHIP_STATUS_COLORS[activeMembership.status]}`}
                >
                  {formatMembershipStatus(activeMembership.status)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium">{typeName(activeMembership)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="font-medium">{formatContactDate(activeMembership.start_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Renews / ends</p>
                <p className="font-medium">
                  {formatContactDate(
                    activeMembership.renewal_date || activeMembership.end_date
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teams (optional)</p>
                <p className="font-medium">{teamsCount}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active membership. Add one to grant member benefits.
            </p>
          )}

          {memberships.length > 1 ? (
            <div className="mt-6 border-t pt-4">
              <p className="mb-2 text-sm font-medium">Membership history</p>
              <ul className="space-y-2 text-sm">
                {memberships
                  .filter((row) => row.id !== activeMembership?.id)
                  .map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <span>
                        {typeName(row)} · {formatContactDate(row.start_date)} –{" "}
                        {row.end_date ? formatContactDate(row.end_date) : "ongoing"}
                      </span>
                      <Badge variant="secondary" className={MEMBERSHIP_STATUS_COLORS[row.status]}>
                        {formatMembershipStatus(row.status)}
                      </Badge>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ContactTeamsPanel contactId={contactId} contactName={contactName} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMembership ? "Edit membership" : "Add membership"}
            </DialogTitle>
            <DialogDescription>
              Membership is separate from program enrollment. Set dates and type for member
              benefits eligibility.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Membership type</Label>
              <Select
                value={form.membershipTypeId || "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    membershipTypeId: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unspecified</SelectItem>
                  {membershipTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    status: value as MembershipStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBERSHIP_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatMembershipStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="membership-start">Start date</Label>
                <Input
                  id="membership-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startDate: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="membership-end">End date</Label>
                <Input
                  id="membership-end"
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endDate: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="membership-renewal">Renewal date</Label>
              <Input
                id="membership-renewal"
                type="date"
                value={form.renewalDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, renewalDate: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="membership-notes">Notes</Label>
              <Textarea
                id="membership-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editingMembership?.status === "active" ? (
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => handleLapse(editingMembership)}
              >
                Mark lapsed
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save membership"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

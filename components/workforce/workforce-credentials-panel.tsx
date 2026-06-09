"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import {
  deleteWorkforceCredential,
  saveWorkforceCredential,
} from "@/lib/workforce/workforce-credential-actions"
import {
  fetchContactCredentials,
  type WorkforceCredentialRecord,
} from "@/lib/workforce/workforce-credential-queries"
import {
  WORKFORCE_CREDENTIAL_TYPES,
  WORKFORCE_CREDENTIAL_TYPE_LABELS,
  formatCredentialType,
  type WorkforceCredentialType,
} from "@/lib/workforce/workforce-credential-constants"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"
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

type WorkforceCredentialsPanelProps = {
  contactId: string
  title?: string
}

type CredentialFormState = {
  credentialType: WorkforceCredentialType
  label: string
  issuedDate: string
  expiresDate: string
  documentUrl: string
  notes: string
}

function emptyForm(): CredentialFormState {
  return {
    credentialType: "cpr",
    label: "",
    issuedDate: "",
    expiresDate: "",
    documentUrl: "",
    notes: "",
  }
}

function toFormState(record?: WorkforceCredentialRecord | null): CredentialFormState {
  if (!record) return emptyForm()
  return {
    credentialType: record.credential_type,
    label: record.label || "",
    issuedDate: record.issued_date || "",
    expiresDate: record.expires_date || "",
    documentUrl: record.document_url || "",
    notes: record.notes || "",
  }
}

function expiryBadgeClass(expiresDate: string | null) {
  if (!expiresDate) return ""
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(`${expiresDate}T00:00:00`)
  if (Number.isNaN(expiry.getTime())) return ""

  const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntil < 0) return "bg-red-100 text-red-800"
  if (daysUntil <= 30) return "bg-amber-100 text-amber-800"
  return "bg-green-100 text-green-800"
}

function expiryLabel(expiresDate: string | null) {
  if (!expiresDate) return "No expiry"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(`${expiresDate}T00:00:00`)
  if (Number.isNaN(expiry.getTime())) return formatContactDate(expiresDate)

  const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntil < 0) return `Expired ${formatContactDate(expiresDate)}`
  if (daysUntil === 0) return "Expires today"
  if (daysUntil <= 30) return `Expires in ${daysUntil} days`
  return `Valid until ${formatContactDate(expiresDate)}`
}

export function WorkforceCredentialsPanel({
  contactId,
  title = "Workforce credentials",
}: WorkforceCredentialsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState<WorkforceCredentialRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkforceCredentialRecord | null>(null)
  const [form, setForm] = useState<CredentialFormState>(emptyForm())

  const expiringSoon = useMemo(
    () =>
      credentials.filter((row) => {
        if (!row.expires_date) return false
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const expiry = new Date(`${row.expires_date}T00:00:00`)
        const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return daysUntil >= 0 && daysUntil <= 30
      }).length,
    [credentials]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchContactCredentials(contactId)
      setCredentials(rows)
    } catch (error) {
      console.error("Error loading credentials:", error)
      setCredentials([])
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function openCreateDialog() {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEditDialog(record: WorkforceCredentialRecord) {
    setEditing(record)
    setForm(toFormState(record))
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveWorkforceCredential({
        id: editing?.id,
        contactId,
        credentialType: form.credentialType,
        label: form.label || null,
        issuedDate: form.issuedDate || null,
        expiresDate: form.expiresDate || null,
        documentUrl: form.documentUrl || null,
        notes: form.notes || null,
      })
      setDialogOpen(false)
      await loadData()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not save credential")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(record: WorkforceCredentialRecord) {
    if (!window.confirm(`Remove ${formatCredentialType(record.credential_type)} credential?`)) {
      return
    }

    setSaving(true)
    try {
      await deleteWorkforceCredential(record.id, contactId)
      await loadData()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not delete credential")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-600" />
                <h2 className="text-lg font-semibold">{title}</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                CPR, First Aid, background checks, and other certifications tracked for workforce
                compliance.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add credential
            </Button>
          </div>

          {expiringSoon > 0 ? (
            <p className="text-sm text-amber-700">
              {expiringSoon} credential{expiringSoon === 1 ? "" : "s"} expiring within 30 days.
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading credentials...
            </div>
          ) : credentials.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No credentials recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {credentials.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {row.label?.trim() || formatCredentialType(row.credential_type)}
                      </p>
                      <Badge variant="secondary">{formatCredentialType(row.credential_type)}</Badge>
                      <Badge
                        variant="secondary"
                        className={expiryBadgeClass(row.expires_date)}
                      >
                        {expiryLabel(row.expires_date)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.issued_date
                        ? `Issued ${formatContactDate(row.issued_date)}`
                        : "Issue date not set"}
                      {row.notes ? ` · ${row.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(row)}
                      disabled={saving}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(row)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit credential" : "Add credential"}</DialogTitle>
            <DialogDescription>
              Track certification type, issue date, and expiry for compliance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={form.credentialType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    credentialType: value as WorkforceCredentialType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFORCE_CREDENTIAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {WORKFORCE_CREDENTIAL_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cred-label">Label (optional)</Label>
              <Input
                id="cred-label"
                value={form.label}
                onChange={(event) =>
                  setForm((current) => ({ ...current, label: event.target.value }))
                }
                placeholder="e.g. Pediatric CPR"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="cred-issued">Issued date</Label>
                <Input
                  id="cred-issued"
                  type="date"
                  value={form.issuedDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, issuedDate: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cred-expires">Expires date</Label>
                <Input
                  id="cred-expires"
                  type="date"
                  value={form.expiresDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, expiresDate: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cred-url">Document URL (optional)</Label>
              <Input
                id="cred-url"
                value={form.documentUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, documentUrl: event.target.value }))
                }
                placeholder="Link to certificate scan"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cred-notes">Notes</Label>
              <Textarea
                id="cred-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add credential"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import {
  mergeContactsAction,
  previewContactMergeAction,
  searchContactsForMergeAction,
  type ContactMergeSearchResult,
} from "@/lib/contacts/contact-merge-actions"
import type { ContactMergePreview } from "@/lib/contacts/contact-merge"

type ContactMergeDialogContact = {
  id: string
  full_name: string | null
  email?: string | null
  phone?: string | null
}

export type ContactMergeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * absorb: keep `fixedContact`, search for duplicate to remove (profile flow).
   * into: remove `fixedContact`, search for contact to keep (list flow).
   */
  mode: "absorb" | "into"
  fixedContact: ContactMergeDialogContact
  onMerged: (survivingContactId: string) => void
}

function formatContactLine(contact: ContactMergeDialogContact) {
  const parts = [contact.full_name || "Unnamed contact"]
  if (contact.email) parts.push(contact.email)
  if (contact.phone) parts.push(contact.phone)
  return parts.join(" · ")
}

function summarizeInventory(preview: ContactMergePreview) {
  const paymentRows = preview.steps
    .filter((step) => step.table === "payments")
    .reduce((sum, step) => sum + (step.rows ?? 0), 0)
  const pledgeRows = preview.steps
    .filter((step) => step.table === "pledges")
    .reduce((sum, step) => sum + (step.rows ?? 0), 0)
  const donorMerge = preview.steps.some((step) => step.table === "donors" && (step.deleted || step.relinked))

  return { paymentRows, pledgeRows, donorMerge }
}

export function ContactMergeDialog({
  open,
  onOpenChange,
  mode,
  fixedContact,
  onMerged,
}: ContactMergeDialogProps) {
  const [search, setSearch] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<ContactMergeSearchResult[]>([])
  const [selectedContact, setSelectedContact] = useState<ContactMergeSearchResult | null>(null)
  const [preview, setPreview] = useState<ContactMergePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)

  const targetContactId = mode === "absorb" ? fixedContact.id : selectedContact?.id
  const sourceContactId = mode === "absorb" ? selectedContact?.id : fixedContact.id

  const keepContact =
    mode === "absorb"
      ? fixedContact
      : selectedContact
        ? {
            id: selectedContact.id,
            full_name: selectedContact.full_name,
            email: selectedContact.email,
            phone: selectedContact.phone,
          }
        : null

  const removeContact =
    mode === "absorb"
      ? selectedContact
        ? {
            id: selectedContact.id,
            full_name: selectedContact.full_name,
            email: selectedContact.email,
            phone: selectedContact.phone,
          }
        : null
      : fixedContact

  const resetState = useCallback(() => {
    setSearch("")
    setResults([])
    setSelectedContact(null)
    setPreview(null)
    setPreviewError(null)
    setSearching(false)
    setPreviewLoading(false)
    setMerging(false)
  }, [])

  useEffect(() => {
    if (!open) resetState()
  }, [open, resetState])

  useEffect(() => {
    if (!open) return
    if (search.trim().length < 2) {
      setResults([])
      return
    }

    const timer = window.setTimeout(async () => {
      setSearching(true)
      setPreviewError(null)

      try {
        const result = await searchContactsForMergeAction({
          search: search.trim(),
          excludeContactId: fixedContact.id,
        })

        if (!result.success) {
          setPreviewError(result.error)
          setResults([])
          return
        }

        setResults(result.contacts)
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : "Could not search contacts.")
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [open, search, fixedContact.id])

  useEffect(() => {
    if (!open || !targetContactId || !sourceContactId) {
      setPreview(null)
      setPreviewError(null)
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    previewContactMergeAction(targetContactId, sourceContactId).then((result) => {
      if (cancelled) return
      setPreviewLoading(false)

      if (!result.success) {
        setPreview(null)
        setPreviewError(result.error)
        return
      }

      setPreview(result.preview)
    })

    return () => {
      cancelled = true
    }
  }, [open, sourceContactId, targetContactId])

  const inventorySummary = useMemo(
    () => (preview ? summarizeInventory(preview) : null),
    [preview]
  )

  async function handleMerge() {
    if (!targetContactId || !sourceContactId) return

    setMerging(true)
    const result = await mergeContactsAction(targetContactId, sourceContactId)
    setMerging(false)

    if (!result.success) {
      setPreviewError(result.error)
      return
    }

    onMerged(result.targetContactId)
    onOpenChange(false)
  }

  const searchLabel =
    mode === "absorb" ? "Duplicate to merge in" : "Contact to keep instead"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Merge duplicate contact</DialogTitle>
          <DialogDescription>
            Combine pledges, payments, notes, and roles into one contact. The duplicate record
            is permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs uppercase text-muted-foreground">
              {mode === "absorb" ? "Keep this contact" : "Remove this contact"}
            </Label>
            <p className="mt-1 font-medium">{formatContactLine(fixedContact)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="merge-search">{searchLabel}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="merge-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSelectedContact(null)
                }}
                placeholder="Search by name, email, or phone"
                className="pl-9"
              />
            </div>

            {searching ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </p>
            ) : null}

            {results.length > 0 ? (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-1">
                {results.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setSelectedContact(contact)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted",
                      selectedContact?.id === contact.id && "bg-muted ring-1 ring-primary/30"
                    )}
                  >
                    <p className="font-medium">{contact.full_name || "Unnamed contact"}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.recordTypeLabel}
                      {contact.email ? ` · ${contact.email}` : ""}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                      {contact.paymentCount + contact.pledgeCount > 0
                        ? ` · ${contact.paymentCount} payments · ${contact.pledgeCount} pledges`
                        : ""}
                    </p>
                  </button>
                ))}
              </div>
            ) : search.trim().length >= 2 && !searching ? (
              <p className="text-sm text-muted-foreground">No matching contacts.</p>
            ) : null}
          </div>

          {removeContact && keepContact ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{removeContact.full_name || "Duplicate"}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium text-foreground">
                {keepContact.full_name || "Keep"}
              </span>
            </div>
          ) : null}

          {previewLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building preview...
            </p>
          ) : null}

          {preview && inventorySummary ? (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">What will move</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                {inventorySummary.paymentRows > 0 ? (
                  <li>{inventorySummary.paymentRows} payment(s)</li>
                ) : null}
                {inventorySummary.pledgeRows > 0 ? (
                  <li>{inventorySummary.pledgeRows} pledge(s)</li>
                ) : null}
                {inventorySummary.donorMerge ? <li>Donor history combined</li> : null}
                {Object.keys(preview.contactPatch).length > 0 ? (
                  <li>Missing details copied to the kept contact</li>
                ) : null}
                <li>{preview.source.full_name || "Duplicate"} contact deleted</li>
              </ul>
            </div>
          ) : null}

          {previewError ? <p className="text-sm text-red-600">{previewError}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleMerge}
            disabled={!targetContactId || !sourceContactId || !preview || previewLoading || merging}
          >
            {merging ? "Merging..." : "Merge contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

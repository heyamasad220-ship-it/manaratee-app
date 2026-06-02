"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import type { ContactNoteRecord } from "@/lib/contacts/contact-profile-data"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ContactNotesPanelProps = {
  contactId: string
  notes: ContactNoteRecord[]
  loading?: boolean
  onNotesChanged: () => void
}

export function ContactNotesPanel({
  contactId,
  notes,
  loading = false,
  onNotesChanged,
}: ContactNotesPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleAddNote() {
    const trimmed = noteText.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error("No organization selected")

      const supabase = createClient()
      const { error } = await supabase.from("contact_notes").insert({
        contact_id: contactId,
        organization_id: orgId,
        note: trimmed,
      })

      if (error) throw error

      setNoteText("")
      setShowForm(false)
      onNotesChanged()
    } catch (error: any) {
      alert(error?.message || "Could not add note.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading notes...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Notes</h2>
            <p className="text-sm text-muted-foreground">
              Internal notes about this contact. Author and category fields will appear when supported by the backend.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowForm((value) => !value)}>
            <Plus className="mr-2 size-4" />
            Add Note
          </Button>
        </div>

        {showForm && (
          <div className="mb-4 space-y-3 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor="contact-note">Note</Label>
              <Textarea
                id="contact-note"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                placeholder="Add a note about this contact..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddNote} disabled={saving || !noteText.trim()}>
                {saving ? "Saving..." : "Save Note"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border p-4">
                <div className="whitespace-pre-wrap text-sm">{note.note}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{formatContactDate(note.created_at)}</span>
                  {note.author_id ? <span>Author available</span> : null}
                  {note.note_type ? <span>Type: {note.note_type}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

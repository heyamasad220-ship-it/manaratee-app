"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  deleteEventDocument,
  updateEventDocumentVisibility,
  uploadEventDocument,
} from "@/lib/events/event-document-actions"
import type {
  EventDocument,
  EventDocumentVisibility,
} from "@/lib/events/event-document-types"

export function InternalEventDocumentsCard({
  eventId,
  documents,
  canManage,
}: {
  eventId: string
  documents: EventDocument[]
  canManage: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [visibility, setVisibility] = useState<EventDocumentVisibility>("staff")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUpload() {
    const file = fileRef.current?.files?.[0]
    setError(null)
    if (!file) {
      setError("Choose a file to upload.")
      return
    }
    const formData = new FormData()
    formData.set("eventId", eventId)
    formData.set("title", title || file.name)
    formData.set("visibility", visibility)
    formData.set("file", file)

    startTransition(async () => {
      const result = await uploadEventDocument(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      setTitle("")
      if (fileRef.current) fileRef.current.value = ""
      router.refresh()
    })
  }

  function handleDelete(documentId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteEventDocument({ eventId, documentId })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleVisibility(documentId: string, next: EventDocumentVisibility) {
    setError(null)
    startTransition(async () => {
      const result = await updateEventDocumentVisibility({
        eventId,
        documentId,
        visibility: next,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Event documents
        </CardTitle>
        <CardDescription>
          Agenda, waivers, permits, and other files. Public files appear on the
          community event page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {doc.title}
                </a>
                <div className="flex flex-wrap items-center gap-2">
                  {canManage ? (
                    <Select
                      value={doc.visibility}
                      disabled={isPending}
                      onValueChange={(value) =>
                        handleVisibility(doc.id, value as EventDocumentVisibility)
                      }
                    >
                      <SelectTrigger className="h-8 w-[7.5rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff only</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {doc.visibility === "public" ? "Public" : "Staff only"}
                    </span>
                  )}
                  {canManage ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={isPending}
                      aria-label={`Delete ${doc.title}`}
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <div className="space-y-3 rounded-md border border-dashed p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-doc-title">Title</Label>
                <Input
                  id="event-doc-title"
                  value={title}
                  placeholder="Event waiver"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select
                  value={visibility}
                  onValueChange={(value) =>
                    setVisibility(value as EventDocumentVisibility)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff only</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-doc-file">File</Label>
              <Input
                id="event-doc-file"
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
              />
            </div>
            <Button type="button" size="sm" disabled={isPending} onClick={handleUpload}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                "Upload document"
              )}
            </Button>
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}

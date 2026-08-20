export type EventDocumentVisibility = "staff" | "public"

export type EventDocument = {
  id: string
  title: string
  fileUrl: string
  mimeType: string | null
  fileSize: number | null
  visibility: EventDocumentVisibility
  createdAt: string
}

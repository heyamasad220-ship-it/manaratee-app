"use client"

import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { contactProfilePath } from "@/lib/vendor-hub/contact-centric-model"
import { VENDOR_DOCUMENT_KINDS } from "@/lib/vendor-hub/vendor-document-kinds"
import {
  deleteVendorDocumentAction,
  updateVendorProfileAction,
  uploadVendorDocumentAction,
} from "@/lib/vendor-hub/vendor-profile-actions"
import type { VendorProfileData } from "@/lib/vendor-hub/vendor-profile-queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { parseSocialLinkSegments } from "@/lib/vendor-hub/vendor-social-links"

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

function SocialLinksDisplay({ value }: { value: string | null | undefined }) {
  if (!value?.trim()) return <span>—</span>

  const segments = parseSocialLinkSegments(value)
  return (
    <span className="break-words">
      {segments.map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={`${segment.href}-${index}`}
            href={segment.href}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            {segment.value}
          </a>
        ) : (
          <span key={`text-${index}`}>{segment.value}</span>
        )
      )}
    </span>
  )
}

export function VendorProfileClient({ profile }: { profile: VendorProfileData }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [documentKind, setDocumentKind] = useState(VENDOR_DOCUMENT_KINDS[0].value)

  const [contactName, setContactName] = useState(profile.contactName)
  const [businessName, setBusinessName] = useState(
    profile.businessName === profile.contactName ? "" : profile.businessName
  )
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [social, setSocial] = useState(profile.social || "")
  const [productsServices, setProductsServices] = useState(profile.productsServices || "")
  const [vendorTypeId, setVendorTypeId] = useState(profile.vendorTypeId || "")

  const displayBusinessName = profile.businessName
  const displayPrimaryContact = profile.primaryContactName

  function handleSave() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await updateVendorProfileAction({
        contactId: profile.contactId,
        contactName,
        businessName,
        email,
        phone,
        social,
        productsServices,
        vendorTypeId: vendorTypeId || null,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setEditing(false)
      setMessage("Vendor profile saved.")
      router.refresh()
    })
  }

  function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set("file", file)
    formData.set("contactId", profile.contactId)
    formData.set("documentKind", documentKind)

    startTransition(async () => {
      const result = await uploadVendorDocumentAction(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      setMessage("Document uploaded.")
      router.refresh()
    })
  }

  function handleDeleteDocument(documentId: string) {
    if (!window.confirm("Delete this document?")) return
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await deleteVendorDocumentAction({
        contactId: profile.contactId,
        documentId,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setMessage("Document deleted.")
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link href={VENDOR_HUB_ROUTES.network.vendors}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to vendors
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{displayBusinessName}</h1>
            <p className="text-sm text-muted-foreground">
              Primary contact:{" "}
              <Link
                href={contactProfilePath(profile.contactId)}
                className="text-primary hover:underline"
              >
                {displayPrimaryContact}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={contactProfilePath(profile.contactId)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open CRM contact
            </Link>
          </Button>
          {!editing ? (
            <Button onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit profile
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor overview</CardTitle>
          <CardDescription>
            Business and contact details for this Vendor Hub relationship.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendor-business-name">Business name</Label>
                <Input
                  id="vendor-business-name"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder={contactName || "Same as contact name"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-contact-name">Primary contact</Label>
                <Input
                  id="vendor-contact-name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor type</Label>
                <Select
                  value={vendorTypeId || "none"}
                  onValueChange={(value) => setVendorTypeId(value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No type</SelectItem>
                    {profile.vendorTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-social">Social / website</Label>
                <Input
                  id="vendor-social"
                  value={social}
                  onChange={(event) => setSocial(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vendor-products">Products / services</Label>
                <Textarea
                  id="vendor-products"
                  rows={3}
                  value={productsServices}
                  onChange={(event) => setProductsServices(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Business name</dt>
                <dd className="mt-1 font-medium">{displayBusinessName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Primary contact</dt>
                <dd className="mt-1 font-medium">
                  <Link
                    href={contactProfilePath(profile.contactId)}
                    className="text-primary hover:underline"
                  >
                    {displayPrimaryContact}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Email</dt>
                <dd className="mt-1">{profile.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Phone</dt>
                <dd className="mt-1">{profile.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Vendor type</dt>
                <dd className="mt-1">
                  {profile.vendorTypeName ? (
                    <Badge variant="secondary">{profile.vendorTypeName}</Badge>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Status</dt>
                <dd className="mt-1 capitalize">{profile.status}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-muted-foreground">Social / website</dt>
                <dd className="mt-1">
                  <SocialLinksDisplay value={profile.social} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-muted-foreground">Products / services</dt>
                <dd className="mt-1 whitespace-pre-wrap">{profile.productsServices || "—"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participation history</CardTitle>
          <CardDescription>Events this vendor paid for or participated in.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Event date</TableHead>
                <TableHead>Booth type</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.participation.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No participation history yet.
                  </TableCell>
                </TableRow>
              ) : (
                profile.participation.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.eventId ? (
                        <Link
                          href={VENDOR_HUB_ROUTES.events.detail(row.eventId)}
                          className="text-primary hover:underline"
                        >
                          {row.eventName}
                        </Link>
                      ) : (
                        row.eventName
                      )}
                    </TableCell>
                    <TableCell>{formatDate(row.eventDate)}</TableCell>
                    <TableCell>{row.boothType || "—"}</TableCell>
                    <TableCell>
                      {row.amount != null ? `$${row.amount.toFixed(2)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Documents</CardTitle>
            <CardDescription>
              Food license, insurance, sales tax permit, and other vendor documents.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={documentKind}
              onValueChange={(value) =>
                setDocumentKind(value as (typeof VENDOR_DOCUMENT_KINDS)[number]["value"])
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_DOCUMENT_KINDS.map((kind) => (
                  <SelectItem key={kind.value} value={kind.value}>
                    {kind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(event) => {
                handleUpload(event.target.files)
                event.target.value = ""
              }}
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No documents uploaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                profile.documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>{doc.documentKindLabel}</TableCell>
                    <TableCell>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {doc.fileName}
                      </a>
                    </TableCell>
                    <TableCell>{formatDate(doc.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useRef, useState, useTransition, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"

import { uploadVenueRentalOrgDocument } from "@/lib/bookings/venue-rental-document-actions"
import { updateVenueRentalOrgSettings } from "@/lib/bookings/venue-rental-settings-actions"
import {
  bufferMinutesToHours,
  hoursToBufferMinutes,
} from "@/lib/bookings/venue-rental-buffers"
import type {
  VenueRentalApprovalMode,
  VenueRentalOrgSettings,
} from "@/lib/bookings/venue-rental-types"
import { VenueRentalsSettingsNav } from "@/components/bookings/venue-rentals-settings-nav"
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
import { Switch } from "@/components/ui/switch"

type VenueRentalGeneralClientProps = {
  settings: VenueRentalOrgSettings
  canManage: boolean
}

type DocState = {
  url: string
  name: string
}

export function VenueRentalGeneralClient({
  settings,
  canManage,
}: VenueRentalGeneralClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [uploadingKind, setUploadingKind] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [securityDepositEnabled, setSecurityDepositEnabled] = useState(
    settings.securityDepositEnabled
  )
  const [defaultAmount, setDefaultAmount] = useState(
    settings.defaultSecurityDepositAmount != null
      ? String(settings.defaultSecurityDepositAmount)
      : ""
  )
  const [policiesDoc, setPoliciesDoc] = useState<DocState>({
    url: settings.policiesDocumentUrl || "",
    name: settings.policiesDocumentName || "",
  })
  const [pricingDoc, setPricingDoc] = useState<DocState>({
    url: settings.pricingGuideUrl || "",
    name: settings.pricingGuideName || "",
  })
  const [approvalMode, setApprovalMode] = useState<VenueRentalApprovalMode>(
    settings.approvalMode
  )
  const [setupHours, setSetupHours] = useState(
    String(bufferMinutesToHours(settings.defaultSetupMinutes || 0))
  )
  const [cleanupHours, setCleanupHours] = useState(
    String(bufferMinutesToHours(settings.defaultCleanupMinutes || 0))
  )

  const policiesInputRef = useRef<HTMLInputElement>(null)
  const pricingInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(
    kind: "policies" | "pricing",
    file: File | undefined
  ) {
    if (!file || !canManage) return
    setError(null)
    setSaved(false)
    setUploadingKind(kind)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("docKind", kind)
      const result = await uploadVenueRentalOrgDocument(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      if (kind === "policies") {
        setPoliciesDoc({ url: result.url, name: result.fileName })
      } else {
        setPricingDoc({ url: result.url, name: result.fileName })
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload document."
      )
    } finally {
      setUploadingKind(null)
    }
  }

  function handleSave() {
    if (!canManage) return
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const next = await updateVenueRentalOrgSettings({
          securityDepositEnabled,
          defaultSecurityDepositAmount: defaultAmount.trim()
            ? Number(defaultAmount)
            : null,
          policiesDocumentUrl: policiesDoc.url || null,
          policiesDocumentName: policiesDoc.name || null,
          pricingGuideUrl: pricingDoc.url || null,
          pricingGuideName: pricingDoc.name || null,
          approvalMode,
          defaultSetupMinutes: hoursToBufferMinutes(setupHours),
          defaultCleanupMinutes: hoursToBufferMinutes(cleanupHours),
        })
        setSecurityDepositEnabled(next.securityDepositEnabled)
        setDefaultAmount(
          next.defaultSecurityDepositAmount != null
            ? String(next.defaultSecurityDepositAmount)
            : ""
        )
        setPoliciesDoc({
          url: next.policiesDocumentUrl || "",
          name: next.policiesDocumentName || "",
        })
        setPricingDoc({
          url: next.pricingGuideUrl || "",
          name: next.pricingGuideName || "",
        })
        setApprovalMode(next.approvalMode)
        setSetupHours(String(bufferMinutesToHours(next.defaultSetupMinutes || 0)))
        setCleanupHours(String(bufferMinutesToHours(next.defaultCleanupMinutes || 0)))
        setSaved(true)
        router.refresh()
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save settings."
        )
      }
    })
  }

  function renderDocRow(
    kind: "policies" | "pricing",
    label: string,
    description: string,
    doc: DocState,
    setDoc: (next: DocState) => void,
    inputRef: RefObject<HTMLInputElement | null>
  ) {
    const busy = uploadingKind === kind || isPending
    return (
      <div className="space-y-3 rounded-md border p-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {doc.url ? (
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {doc.name || "View document"}
            </a>
            {canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={`Remove ${label}`}
                onClick={() => setDoc({ url: "", name: "" })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No file uploaded.</p>
        )}
        {canManage ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                void handleUpload(kind, event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {uploadingKind === kind ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {doc.url ? "Replace file" : "Upload PDF"}
                </>
              )}
            </Button>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Customize how venue rentals work for your organization.
        </p>
      </div>

      <VenueRentalsSettingsNav />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Settings saved.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup & cleanup buffers</CardTitle>
          <CardDescription>
            Automatically block time before and after each booking so the space
            is not double-booked during setup or teardown. For example, 4 hours
            of setup before a 6:00 PM event blocks the space from 2:00 PM.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="default-setup-hours">Setup buffer (hours)</Label>
            <Input
              id="default-setup-hours"
              type="number"
              min={0}
              max={24}
              step="0.25"
              value={setupHours}
              disabled={!canManage || isPending}
              onChange={(event) => setSetupHours(event.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Applied before the event start on new bookings. Spaces can override
              this in Facilities → Spaces.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="default-cleanup-hours">Cleanup buffer (hours)</Label>
            <Input
              id="default-cleanup-hours"
              type="number"
              min={0}
              max={24}
              step="0.25"
              value={cleanupHours}
              disabled={!canManage || isPending}
              onChange={(event) => setCleanupHours(event.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Applied after the event end on new bookings.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security deposit</CardTitle>
          <CardDescription>
            Turn this on only if you collect a refundable security deposit and return
            it after the event. Leave it off if you keep a card on file and charge
            extras (damage, cleaning) as needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="security-deposit-enabled">
                Collect refundable security deposits
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled: staff can set a security deposit on approval, and
                after the event they can mark inspection complete and refund the
                deposit. When disabled: post-event work uses Add charge for extras,
                and rentals complete without a deposit-refund step.
              </p>
            </div>
            <Switch
              id="security-deposit-enabled"
              checked={securityDepositEnabled}
              disabled={!canManage || isPending}
              onCheckedChange={setSecurityDepositEnabled}
            />
          </div>

          {securityDepositEnabled ? (
            <div className="grid max-w-sm gap-2">
              <Label htmlFor="default-security-deposit">
                Default security deposit amount (optional)
              </Label>
              <Input
                id="default-security-deposit"
                type="number"
                min={0}
                step="0.01"
                value={defaultAmount}
                disabled={!canManage || isPending}
                onChange={(event) => setDefaultAmount(event.target.value)}
                placeholder="e.g. 250"
              />
              <p className="text-xs text-muted-foreground">
                Prefills the approve form. Staff can still change the amount per
                rental.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer documents</CardTitle>
          <CardDescription>
            When a booking request is submitted, these files are sent to the
            customer. They must agree before the request can be approved (unless
            you have not uploaded any documents).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderDocRow(
            "policies",
            "Policies & procedures",
            "Rules, cancellation, and facility policies.",
            policiesDoc,
            setPoliciesDoc,
            policiesInputRef
          )}
          {renderDocRow(
            "pricing",
            "Pricing guide",
            "Rates and fees for spaces and add-ons.",
            pricingDoc,
            setPricingDoc,
            pricingInputRef
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval after agreement</CardTitle>
          <CardDescription>
            Choose what happens once the customer agrees to your documents.
            Different organizations can use different workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid max-w-lg gap-2">
            <Label htmlFor="approval-mode">Approval mode</Label>
            <Select
              value={approvalMode}
              disabled={!canManage || isPending}
              onValueChange={(value) =>
                setApprovalMode(value as VenueRentalApprovalMode)
              }
            >
              <SelectTrigger id="approval-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Manual — staff review, then approve
                </SelectItem>
                <SelectItem value="auto_after_agreement">
                  Auto-approve after customer agrees
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto-approve requests the quoted rental total as the deposit and
              moves the booking to Approved. Manual mode keeps the request in
              Submitted until staff approves.
            </p>
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <Button type="button" disabled={isPending || Boolean(uploadingKind)} onClick={handleSave}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save settings"
          )}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          You need manage permission to change these settings.
        </p>
      )}
    </div>
  )
}

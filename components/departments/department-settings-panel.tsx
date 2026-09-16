"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"

import {
  deleteDepartment,
  fetchDepartmentDeleteUsage,
  updateDepartment,
  updateDepartmentTerms,
  type DepartmentStaffMember,
} from "@/lib/departments/department-actions"
import { departmentDeleteBlockedReason } from "@/lib/departments/department-delete-blockers"
import { WORKFORCE_DEPARTMENTS_PATH } from "@/lib/departments/department-paths"
import { setDepartmentDirectorAction } from "@/lib/departments/department-staff-actions"
import { uploadDepartmentTermsPdf } from "@/lib/departments/department-terms-actions"
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
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"
import { createClient } from "@/lib/supabase/client"
import { sanitizeRichTextHtml } from "@/lib/ui/rich-text"

const UNASSIGNED_DIRECTOR = "none"

export function DepartmentSettingsPanel({
  departmentId,
  departmentName,
  departmentDescription = null,
  departmentColor = null,
  departmentTermsHtml = null,
  departmentTermsPdfUrl = null,
  staff = [],
  onDepartmentMetaChanged,
}: {
  departmentId: string
  departmentName: string
  departmentDescription?: string | null
  departmentColor?: string | null
  departmentTermsHtml?: string | null
  departmentTermsPdfUrl?: string | null
  staff?: DepartmentStaffMember[]
  onDepartmentMetaChanged?: () => void
}) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(departmentName)
  const [colorDraft, setColorDraft] = React.useState(
    departmentColor || "#3b82f6"
  )
  const [flyerUrl, setFlyerUrl] = React.useState<string | null>(null)
  const [deleteUsage, setDeleteUsage] = React.useState({
    programs: 0,
    offerings: 0,
    employees: 0,
  })
  const [deleteUsageLoaded, setDeleteUsageLoaded] = React.useState(false)

  const [descriptionDraft, setDescriptionDraft] = React.useState(
    departmentDescription || ""
  )
  const [termsDraft, setTermsDraft] = React.useState(departmentTermsHtml || "")
  const [termsPdfUrl, setTermsPdfUrl] = React.useState(
    departmentTermsPdfUrl || ""
  )
  const [metaError, setMetaError] = React.useState<string | null>(null)
  const [pdfUploading, setPdfUploading] = React.useState(false)
  const pdfInputRef = React.useRef<HTMLInputElement>(null)
  const savedDirectorId =
    staff.find((member) => member.isDepartmentHead)?.staffId ?? ""
  const [directorStaffId, setDirectorStaffId] = React.useState(savedDirectorId)

  React.useEffect(() => {
    void fetchDepartmentMeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId])

  React.useEffect(() => {
    setNameDraft(departmentName)
  }, [departmentName])

  React.useEffect(() => {
    setColorDraft(departmentColor || "#3b82f6")
  }, [departmentColor])

  React.useEffect(() => {
    setDescriptionDraft(departmentDescription || "")
  }, [departmentDescription])

  React.useEffect(() => {
    setTermsDraft(departmentTermsHtml || "")
  }, [departmentTermsHtml])

  React.useEffect(() => {
    setTermsPdfUrl(departmentTermsPdfUrl || "")
  }, [departmentTermsPdfUrl])

  React.useEffect(() => {
    setDirectorStaffId(savedDirectorId)
  }, [savedDirectorId])

  const descriptionDirty =
    sanitizeRichTextHtml(descriptionDraft) !==
    sanitizeRichTextHtml(departmentDescription || "")
  const termsDirty =
    sanitizeRichTextHtml(termsDraft) !==
    sanitizeRichTextHtml(departmentTermsHtml || "")
  const nameDirty = nameDraft.trim() !== departmentName.trim()
  const colorDirty =
    (colorDraft.startsWith("#") ? colorDraft : "#3b82f6") !==
    (departmentColor?.startsWith("#") ? departmentColor : "#3b82f6")
  const settingsDirty =
    nameDirty ||
    colorDirty ||
    descriptionDirty ||
    termsDirty ||
    directorStaffId !== savedDirectorId
  const deleteBlockedReason = deleteUsageLoaded
    ? departmentDeleteBlockedReason(deleteUsage)
    : "Checking whether this department can be deleted…"

  async function fetchDepartmentMeta() {
    try {
      const orgId = await getSelectedOrganizationIdClient()
      if (!orgId) return

      const [departmentResult, usage] = await Promise.all([
        supabase
          .from("departments")
          .select("name, description, color, flyer_url")
          .eq("organization_id", orgId)
          .eq("id", departmentId)
          .maybeSingle(),
        fetchDepartmentDeleteUsage(departmentId),
      ])

      if (!departmentResult.error && departmentResult.data) {
        setNameDraft((departmentResult.data.name as string) || departmentName)
        setColorDraft((departmentResult.data.color as string) || "#3b82f6")
        setFlyerUrl((departmentResult.data.flyer_url as string | null) ?? null)
      }
      setDeleteUsage(usage)
      setDeleteUsageLoaded(true)
    } catch (error) {
      console.error("Department settings error:", error)
    }
  }

  async function handleSave() {
    if (!nameDraft.trim()) return

    setSaving(true)
    setMetaError(null)
    try {
      await Promise.all([
        updateDepartment({
          id: departmentId,
          name: nameDraft.trim(),
          description: descriptionDraft,
          color: colorDraft,
          flyerUrl,
        }),
        updateDepartmentTerms({
          id: departmentId,
          termsHtml: termsDraft,
        }),
        setDepartmentDirectorAction({
          departmentId,
          staffId: directorStaffId || null,
        }).then((result) => {
          if (!result.success) {
            throw new Error(result.error)
          }
        }),
      ])
      onDepartmentMetaChanged?.()
    } catch (error: unknown) {
      console.error("Save department settings error:", error)
      setMetaError(
        error instanceof Error ? error.message : "Could not save department."
      )
    } finally {
      setSaving(false)
    }
  }

  async function saveTermsPdf(nextUrl: string | null) {
    setMetaError(null)
    try {
      await updateDepartmentTerms({
        id: departmentId,
        termsPdfUrl: nextUrl,
      })
      setTermsPdfUrl(nextUrl || "")
      onDepartmentMetaChanged?.()
    } catch (saveError) {
      setMetaError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save terms PDF."
      )
    }
  }

  async function handlePdfUpload(file: File | undefined) {
    if (!file) return
    setMetaError(null)
    setPdfUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("departmentId", departmentId)
      const result = await uploadDepartmentTermsPdf(formData)
      if (!result.success) {
        setMetaError(result.error)
        return
      }
      await saveTermsPdf(result.url)
    } finally {
      setPdfUploading(false)
    }
  }

  async function handleDeleteDepartment() {
    if (departmentDeleteBlockedReason(deleteUsage) || !deleteUsageLoaded) return

    const confirmed = window.confirm("Delete this department?")
    if (!confirmed) return

    try {
      await deleteDepartment(departmentId)
      router.push(WORKFORCE_DEPARTMENTS_PATH)
    } catch (error: unknown) {
      console.error("Delete department error:", error)
      alert(error instanceof Error ? error.message : "Could not delete department.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Department settings for {departmentName}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor="settings-department-name">Name</Label>
              <Input
                id="settings-department-name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-department-color">Color</Label>
              <Input
                id="settings-department-color"
                type="color"
                className="h-10 w-20 cursor-pointer p-1"
                value={colorDraft.startsWith("#") ? colorDraft : "#3b82f6"}
                onChange={(event) => setColorDraft(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-department-director">Director Name</Label>
            <Select
              value={directorStaffId || UNASSIGNED_DIRECTOR}
              onValueChange={(value) =>
                setDirectorStaffId(value === UNASSIGNED_DIRECTOR ? "" : value)
              }
            >
              <SelectTrigger
                id="settings-department-director"
                className="w-full"
              >
                <SelectValue placeholder="Not assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_DIRECTOR}>Not assigned</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.staffId} value={member.staffId}>
                    {member.fullName}
                    {member.employmentStatus &&
                    member.employmentStatus.toLowerCase() !== "active"
                      ? ` (${member.employmentStatus})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {staff.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add employees under Financial → Employees, then choose the
                director here.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          <CardDescription>
            Short summary of this department.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <RichTextEditor
            value={descriptionDraft}
            onChange={setDescriptionDraft}
            placeholder="Describe this department…"
            minHeightClassName="min-h-[96px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms and Conditions</CardTitle>
          <CardDescription>
            Shown to families, plus an optional PDF attachment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>Terms text</Label>
            <RichTextEditor
              value={termsDraft}
              onChange={setTermsDraft}
              placeholder="Enter department terms and conditions…"
              minHeightClassName="min-h-[120px]"
            />
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <div>
              <p className="text-sm font-medium">Terms PDF</p>
              <p className="text-sm text-muted-foreground">
                Optional downloadable PDF of the full terms document.
              </p>
            </div>
            {termsPdfUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <a
                  href={termsPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  View terms PDF
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pdfUploading}
                  aria-label="Remove terms PDF"
                  onClick={() => void saveTermsPdf(null)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No PDF uploaded.</p>
            )}
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(event) => {
                void handlePdfUpload(event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pdfUploading}
              onClick={() => pdfInputRef.current?.click()}
            >
              {pdfUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {termsPdfUrl ? "Replace PDF" : "Upload PDF"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {metaError ? <p className="text-sm text-destructive">{metaError}</p> : null}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-start sm:justify-between">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !nameDraft.trim() || !settingsDirty}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
        <div className="flex max-w-md flex-col items-start gap-1 sm:items-end">
          <Button
            type="button"
            variant="destructive"
            disabled={Boolean(deleteBlockedReason)}
            title={deleteBlockedReason ?? undefined}
            onClick={() => void handleDeleteDepartment()}
          >
            Delete department
          </Button>
          {deleteBlockedReason ? (
            <p className="text-xs text-muted-foreground">{deleteBlockedReason}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

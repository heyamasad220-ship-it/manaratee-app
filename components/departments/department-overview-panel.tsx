"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"

import { ProgramFlyerField } from "@/components/programs/edit/program-flyer-field"
import {
  RichTextDisplay,
  RichTextEditor,
} from "@/components/ui/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  updateDepartment,
  updateDepartmentFlyer,
  updateDepartmentTerms,
} from "@/lib/departments/department-actions"
import { uploadDepartmentTermsPdf } from "@/lib/departments/department-terms-actions"
import { fetchDepartmentYearProgramsAction } from "@/lib/departments/department-year-actions"
import { sanitizeRichTextHtml } from "@/lib/ui/rich-text"
import { cn } from "@/lib/utils"

const FLYER_PLACEHOLDER_COLORS = [
  "bg-sky-500",
  "bg-emerald-400",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-400",
  "bg-indigo-500",
] as const

function getFlyerPlaceholderColor(departmentId: string) {
  let hash = 0
  for (let index = 0; index < departmentId.length; index += 1) {
    hash = (hash + departmentId.charCodeAt(index) * (index + 1)) % 997
  }
  return FLYER_PLACEHOLDER_COLORS[hash % FLYER_PLACEHOLDER_COLORS.length]
}

export function DepartmentOverviewPanel({
  departmentId,
  departmentName,
  departmentDescription = null,
  departmentFlyerUrl = null,
  departmentColor = null,
  departmentTermsHtml = null,
  departmentTermsPdfUrl = null,
  onDepartmentMetaChanged,
}: {
  departmentId: string
  departmentName: string
  departmentDescription?: string | null
  departmentFlyerUrl?: string | null
  departmentColor?: string | null
  departmentTermsHtml?: string | null
  departmentTermsPdfUrl?: string | null
  onDepartmentMetaChanged?: () => void
}) {
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [canEditMeta, setCanEditMeta] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(
    departmentDescription || ""
  )
  const [termsDraft, setTermsDraft] = useState(departmentTermsHtml || "")
  const [deptFlyerDraft, setDeptFlyerDraft] = useState(departmentFlyerUrl || "")
  const [termsPdfUrl, setTermsPdfUrl] = useState(departmentTermsPdfUrl || "")
  const [metaError, setMetaError] = useState<string | null>(null)
  const [metaSaving, setMetaSaving] = useState(false)
  const [termsSaving, setTermsSaving] = useState(false)
  const [pdfUploading, setPdfUploading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await fetchDepartmentYearProgramsAction(departmentId)
      if (cancelled) return
      if (result.success) {
        setCanEditMeta(result.data.canManageYears)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [departmentId])

  useEffect(() => {
    setDescriptionDraft(departmentDescription || "")
  }, [departmentDescription])

  useEffect(() => {
    setDeptFlyerDraft(departmentFlyerUrl || "")
  }, [departmentFlyerUrl])

  useEffect(() => {
    setTermsDraft(departmentTermsHtml || "")
  }, [departmentTermsHtml])

  useEffect(() => {
    setTermsPdfUrl(departmentTermsPdfUrl || "")
  }, [departmentTermsPdfUrl])

  const descriptionDirty =
    sanitizeRichTextHtml(descriptionDraft) !==
    sanitizeRichTextHtml(departmentDescription || "")
  const termsDirty =
    sanitizeRichTextHtml(termsDraft) !==
    sanitizeRichTextHtml(departmentTermsHtml || "")

  async function saveDescription() {
    setMetaError(null)
    setMetaSaving(true)
    try {
      await updateDepartment({
        id: departmentId,
        name: departmentName,
        description: descriptionDraft.trim() || undefined,
        color: departmentColor || undefined,
        flyerUrl: deptFlyerDraft || null,
      })
      onDepartmentMetaChanged?.()
    } catch (saveError) {
      setMetaError(
        saveError instanceof Error ? saveError.message : "Could not save description."
      )
    } finally {
      setMetaSaving(false)
    }
  }

  async function saveDepartmentFlyer(nextUrl: string) {
    setDeptFlyerDraft(nextUrl)
    setMetaError(null)
    try {
      await updateDepartmentFlyer({
        id: departmentId,
        flyerUrl: nextUrl || null,
      })
      onDepartmentMetaChanged?.()
    } catch (saveError) {
      setMetaError(
        saveError instanceof Error ? saveError.message : "Could not save flyer."
      )
    }
  }

  async function saveTermsHtml() {
    setMetaError(null)
    setTermsSaving(true)
    try {
      await updateDepartmentTerms({
        id: departmentId,
        termsHtml: termsDraft,
      })
      onDepartmentMetaChanged?.()
    } catch (saveError) {
      setMetaError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save terms and conditions."
      )
    } finally {
      setTermsSaving(false)
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

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        <div className="flex h-full min-h-[280px] flex-col lg:col-span-1">
          {canEditMeta ? (
            <ProgramFlyerField
              value={deptFlyerDraft}
              onValueChange={(value) => void saveDepartmentFlyer(value)}
              hideHiddenInput
              hideLabel
              emptyLabel="Add Flyer"
              frameClassName="h-auto min-h-0 flex-1"
            />
          ) : deptFlyerDraft ? (
            <div className="h-full min-h-[280px] overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={deptFlyerDraft}
                alt={`${departmentName} flyer`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className={cn(
                "flex h-full min-h-[280px] items-center justify-center rounded-lg text-3xl font-semibold text-white/90",
                getFlyerPlaceholderColor(departmentId)
              )}
            >
              {departmentName.trim().charAt(0).toUpperCase() || "D"}
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-2 lg:col-span-2">
          <Label htmlFor="department-overview-description">Description</Label>
          {canEditMeta ? (
            <>
              <RichTextEditor
                value={descriptionDraft}
                onChange={setDescriptionDraft}
                placeholder="Describe this department…"
                minHeightClassName="min-h-[220px]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={metaSaving || !descriptionDirty}
                  onClick={() => void saveDescription()}
                >
                  {metaSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save description
                </Button>
              </div>
            </>
          ) : (
            <RichTextDisplay html={departmentDescription} />
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Terms and Conditions
          </h2>
          <p className="text-sm text-muted-foreground">
            Rich text shown to families, plus an optional PDF attachment.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="department-overview-terms">Terms text</Label>
          {canEditMeta ? (
            <>
              <RichTextEditor
                value={termsDraft}
                onChange={setTermsDraft}
                placeholder="Enter department terms and conditions…"
                minHeightClassName="min-h-[200px]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={termsSaving || !termsDirty}
                  onClick={() => void saveTermsHtml()}
                >
                  {termsSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save terms
                </Button>
              </div>
            </>
          ) : departmentTermsHtml ? (
            <RichTextDisplay html={departmentTermsHtml} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No terms and conditions yet.
            </p>
          )}
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
              {canEditMeta ? (
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
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No PDF uploaded.</p>
          )}
          {canEditMeta ? (
            <>
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
            </>
          ) : null}
        </div>

        {metaError ? <p className="text-sm text-destructive">{metaError}</p> : null}
      </section>
    </div>
  )
}

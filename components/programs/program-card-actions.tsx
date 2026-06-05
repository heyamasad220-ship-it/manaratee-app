"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Copy,
  Link2,
  Loader2,
  Pencil,
  QrCode,
  Trash2,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  deleteProgram,
  duplicateProgram,
} from "@/lib/programs/program-catalog-actions"
import { buildProgramRegistrationUrl } from "@/lib/programs/program-customer-url"

function ActionIconButton({
  label,
  onClick,
  href,
  disabled,
  isLoading,
  children,
  className,
}: {
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  isLoading?: boolean
  children: React.ReactNode
  className?: string
}) {
  const button = href ? (
    <Button
      variant="outline"
      size="icon"
      className={`h-8 w-8 ${className ?? ""}`}
      asChild
      disabled={disabled}
    >
      <Link href={href} aria-label={label}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </Link>
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={`h-8 w-8 ${className ?? ""}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={label}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

async function downloadQrCode(url: string, filename: string) {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(url)}`
  const response = await fetch(qrImageUrl)

  if (!response.ok) {
    throw new Error("Failed to generate QR code.")
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = `${filename}-registration-qr.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function ProgramCardActions({
  programId,
  programName,
  programStatus,
}: {
  programId: string
  programName: string
  programStatus: string
}) {
  const router = useRouter()
  const canShareRegistration = programStatus === "active"
  const [pendingAction, setPendingAction] = React.useState<
    "copy" | "delete" | "copyUrl" | "qr" | null
  >(null)
  const [feedback, setFeedback] = React.useState<string | null>(null)

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  async function handleCopyProgram() {
    setPendingAction("copy")
    setFeedback(null)

    try {
      const result = await duplicateProgram(programId)

      if (!result.success) {
        showFeedback(result.error)
        return
      }

      router.push(`/programs/${result.programId}/edit?created=1`)
      router.refresh()
    } catch {
      showFeedback("Failed to copy program.")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleDeleteProgram() {
    setPendingAction("delete")
    setFeedback(null)

    try {
      const result = await deleteProgram(programId)

      if (!result.success) {
        showFeedback(result.error)
        return
      }

      router.refresh()
    } catch {
      showFeedback("Failed to delete program.")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleCopyRegistrationUrl() {
    if (!canShareRegistration) {
      showFeedback("Set program status to Active before sharing a registration link.")
      return
    }

    setPendingAction("copyUrl")
    setFeedback(null)

    try {
      const url = buildProgramRegistrationUrl(
        programId,
        window.location.origin
      )
      await navigator.clipboard.writeText(url)
      showFeedback("Registration link copied.")
    } catch {
      showFeedback("Failed to copy registration link.")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleDownloadQrCode() {
    if (!canShareRegistration) {
      showFeedback("Set program status to Active before downloading a QR code.")
      return
    }

    setPendingAction("qr")
    setFeedback(null)

    try {
      const url = buildProgramRegistrationUrl(
        programId,
        window.location.origin
      )
      const safeName = programName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
      await downloadQrCode(url, safeName || "program")
      showFeedback("QR code downloaded.")
    } catch {
      showFeedback("Failed to download QR code.")
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionIconButton
          label="Edit program"
          href={`/programs/${programId}/edit`}
        >
          <Pencil className="h-4 w-4" />
        </ActionIconButton>

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="Delete program"
                  disabled={pendingAction === "delete"}
                >
                  {pendingAction === "delete" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Delete program</TooltipContent>
          </Tooltip>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {programName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the program. Programs with registrations
                or waitlist entries cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleDeleteProgram()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ActionIconButton
          label="Copy program"
          onClick={() => void handleCopyProgram()}
          isLoading={pendingAction === "copy"}
        >
          <Copy className="h-4 w-4" />
        </ActionIconButton>

        <ActionIconButton
          label={
            canShareRegistration
              ? "Copy registration link"
              : "Copy registration link (Active programs only)"
          }
          onClick={() => void handleCopyRegistrationUrl()}
          isLoading={pendingAction === "copyUrl"}
          disabled={!canShareRegistration}
        >
          <Link2 className="h-4 w-4" />
        </ActionIconButton>

        <ActionIconButton
          label={
            canShareRegistration
              ? "Download QR code"
              : "Download QR code (Active programs only)"
          }
          onClick={() => void handleDownloadQrCode()}
          isLoading={pendingAction === "qr"}
          disabled={!canShareRegistration}
        >
          <QrCode className="h-4 w-4" />
        </ActionIconButton>
      </div>

      {feedback ? (
        <p className="text-xs text-muted-foreground">{feedback}</p>
      ) : null}
    </div>
  )
}

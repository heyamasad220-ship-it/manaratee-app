"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Copy,
  ImageIcon,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  QrCode,
  Archive,
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
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  deleteProgram,
  duplicateProgram,
} from "@/lib/programs/program-catalog-actions"
import { buildProgramRegistrationUrl } from "@/lib/programs/program-customer-url"

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
  editLabel = "View Details",
  onEditFlyer,
  onArchiveYear,
  hideDelete = false,
}: {
  programId: string
  programName: string
  programStatus: string
  /** Primary open label (department Overview uses "View / Edit"). */
  editLabel?: string
  onEditFlyer?: () => void
  onArchiveYear?: () => void
  /** Department year cards: use Archive instead of permanent Delete. */
  hideDelete?: boolean
}) {
  const router = useRouter()
  const canShareRegistration = programStatus === "active"
  const [pendingAction, setPendingAction] = React.useState<
    "copy" | "delete" | "copyUrl" | "qr" | null
  >(null)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

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

      router.push(`/programs/${result.programId}`)
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

      setDeleteOpen(false)
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
      const url = buildProgramRegistrationUrl(programId, window.location.origin)
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
      const url = buildProgramRegistrationUrl(programId, window.location.origin)
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

  const isBusy = pendingAction !== null

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Year/Season actions"
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/programs/${programId}`}>
              <Pencil className="h-4 w-4" />
              {editLabel}
            </Link>
          </DropdownMenuItem>
          {onEditFlyer ? (
            <DropdownMenuItem onClick={onEditFlyer}>
              <ImageIcon className="h-4 w-4" />
              Edit flyer
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={pendingAction === "copy"}
            onClick={() => void handleCopyProgram()}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canShareRegistration || pendingAction === "copyUrl"}
            onClick={() => void handleCopyRegistrationUrl()}
            title={
              canShareRegistration
                ? undefined
                : "Active programs only"
            }
          >
            <Link2 className="h-4 w-4" />
            Registration Link
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canShareRegistration || pendingAction === "qr"}
            onClick={() => void handleDownloadQrCode()}
            title={
              canShareRegistration
                ? undefined
                : "Active programs only"
            }
          >
            <QrCode className="h-4 w-4" />
            Download QR Code
          </DropdownMenuItem>
          {onArchiveYear ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={onArchiveYear}
              >
                <Archive className="h-4 w-4" />
                Archive year
              </DropdownMenuItem>
            </>
          ) : null}
          {!hideDelete && !onArchiveYear ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={pendingAction === "delete"}
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {programName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the program. Programs with registrations or
              waitlist entries cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction === "delete"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pendingAction === "delete"}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteProgram()
              }}
            >
              {pendingAction === "delete" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {feedback ? (
        <p className="absolute right-0 top-full z-10 mt-1 w-48 text-right text-[10px] text-muted-foreground">
          {feedback}
        </p>
      ) : null}
    </div>
  )
}

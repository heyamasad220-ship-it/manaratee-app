"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react"

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
  deleteInternalEvent,
  duplicateInternalEvent,
} from "@/lib/events/internal-event-actions"

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

export function InternalEventCardActions({
  eventId,
  eventName,
  compact = false,
}: {
  eventId: string
  eventName: string
  compact?: boolean
}) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = React.useState<"copy" | "delete" | null>(
    null
  )
  const [feedback, setFeedback] = React.useState<string | null>(null)

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  async function handleCopyEvent() {
    setPendingAction("copy")
    setFeedback(null)

    try {
      const result = await duplicateInternalEvent(eventId)

      if (!result.success) {
        showFeedback(result.error)
        return
      }

      router.push(`/event-management/${result.eventId}/edit?copied=1`)
      router.refresh()
    } catch {
      showFeedback("Failed to copy event.")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleDeleteEvent() {
    setPendingAction("delete")
    setFeedback(null)

    try {
      const result = await deleteInternalEvent(eventId)

      if (!result.success) {
        showFeedback(result.error)
        return
      }

      router.refresh()
    } catch {
      showFeedback("Failed to delete event.")
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className={compact ? "" : "space-y-2"}>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <ActionIconButton
          label="Edit event"
          href={`/event-management/${eventId}/edit`}
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
                  aria-label="Delete event"
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
            <TooltipContent>Delete event</TooltipContent>
          </Tooltip>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {eventName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the event and its calendar reservation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleDeleteEvent()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ActionIconButton
          label="Copy event"
          onClick={() => void handleCopyEvent()}
          isLoading={pendingAction === "copy"}
        >
          <Copy className="h-4 w-4" />
        </ActionIconButton>
      </div>

      {feedback ? (
        <p className="text-xs text-muted-foreground">{feedback}</p>
      ) : null}
    </div>
  )
}

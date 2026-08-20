"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { updateInternalEventFlyerFocal } from "@/lib/events/internal-event-actions"

export function CommunityFeaturedFlyer({
  eventId,
  source,
  flyerUrl,
  name,
  focalX = 50,
  focalY = 50,
  className,
  priority = false,
  placeholder = false,
  editable = false,
}: {
  eventId?: string
  source?: "event" | "bazaar"
  flyerUrl: string | null
  name: string
  focalX?: number
  focalY?: number
  className?: string
  priority?: boolean
  placeholder?: boolean
  /** Staff can drag to set crop (Event Management events only). */
  editable?: boolean
}) {
  const router = useRouter()
  const frameRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: focalX, y: focalY })
  const positionRef = useRef(position)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
  } | null>(null)

  useEffect(() => {
    const next = { x: focalX, y: focalY }
    setPosition(next)
    positionRef.current = next
  }, [focalX, focalY, flyerUrl])

  const canDrag = Boolean(editable && flyerUrl && source === "event" && eventId)

  function clamp(value: number) {
    return Math.min(100, Math.max(0, value))
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canDrag || pending) return
    event.preventDefault()
    frameRef.current?.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: positionRef.current.x,
      startY: positionRef.current.y,
    }
    setError(null)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const frame = frameRef.current
    if (!drag || drag.pointerId !== event.pointerId || !frame) return

    const rect = frame.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const dx = ((event.clientX - drag.startClientX) / rect.width) * 100
    const dy = ((event.clientY - drag.startClientY) / rect.height) * 100
    // Dragging the image right reveals more of the left → lower object-position x
    const next = {
      x: clamp(drag.startX - dx),
      y: clamp(drag.startY - dy),
    }
    positionRef.current = next
    setPosition(next)
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    try {
      frameRef.current?.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }

    if (!canDrag || !eventId) return

    const next = positionRef.current
    if (
      Math.abs(next.x - focalX) < 0.2 &&
      Math.abs(next.y - focalY) < 0.2
    ) {
      return
    }

    startTransition(async () => {
      const result = await updateInternalEventFlyerFocal({
        eventId,
        focalX: next.x,
        focalY: next.y,
      })
      if (!result.success) {
        setError(result.error || "Could not save crop.")
        const revert = { x: focalX, y: focalY }
        positionRef.current = revert
        setPosition(revert)
        return
      }
      router.refresh()
    })
  }

  if (flyerUrl) {
    return (
      <div className="space-y-2">
        <div
          ref={frameRef}
          className={cn(
            "relative overflow-hidden bg-zinc-200 touch-none",
            canDrag && "cursor-grab active:cursor-grabbing",
            className
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          role={canDrag ? "img" : undefined}
          aria-label={
            canDrag
              ? `${name} flyer — drag to adjust banner crop`
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flyerUrl}
            alt={`${name} flyer`}
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-cover"
            style={{ objectPosition: `${position.x}% ${position.y}%` }}
            {...(priority ? { fetchPriority: "high" as const } : {})}
          />
          {pending ? (
            <div className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-1.5 text-center text-xs text-white">
              Saving crop…
            </div>
          ) : null}
        </div>
        {canDrag ? (
          <p className="text-xs text-muted-foreground">
            Drag the flyer to choose which part shows in the banner.
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 text-center",
        placeholder
          ? "bg-gradient-to-br from-zinc-200 to-zinc-300"
          : "bg-gradient-to-br from-teal-700 to-teal-900",
        className
      )}
    >
      <span
        className={cn(
          "line-clamp-4 text-sm font-semibold leading-snug sm:text-base",
          placeholder ? "text-zinc-500" : "text-white/95"
        )}
      >
        {name}
      </span>
    </div>
  )
}

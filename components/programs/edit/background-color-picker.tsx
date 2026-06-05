"use client"

import * as React from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type HsvColor = {
  h: number
  s: number
  v: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "")
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255,
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) =>
    Math.round(clamp(value, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0")

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6
    } else {
      h = ((r - g) / delta + 4) / 6
    }
  }

  const s = max === 0 ? 0 : delta / max
  const v = max

  return { h: h * 360, s, v }
}

function hsvToRgb(h: number, s: number, v: number) {
  const normalizedHue = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((normalizedHue / 60) % 2) - 1))
  const m = v - c

  let r = 0
  let g = 0
  let b = 0

  if (normalizedHue < 60) {
    r = c
    g = x
  } else if (normalizedHue < 120) {
    r = x
    g = c
  } else if (normalizedHue < 180) {
    g = c
    b = x
  } else if (normalizedHue < 240) {
    g = x
    b = c
  } else if (normalizedHue < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: r + m,
    g: g + m,
    b: b + m,
  }
}

function hsvToHex(hsv: HsvColor) {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return rgbToHex(r, g, b)
}

function hexToHsv(hex: string): HsvColor {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return { h: 220, s: 0.72, v: 0.92 }
  }

  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

export function BackgroundColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [committedHsv, setCommittedHsv] = React.useState(() => hexToHsv(value))
  const [draftHsv, setDraftHsv] = React.useState(() => hexToHsv(value))
  const areaRef = React.useRef<HTMLDivElement>(null)
  const [isDraggingArea, setIsDraggingArea] = React.useState(false)

  React.useEffect(() => {
    const nextHsv = hexToHsv(value)
    setCommittedHsv(nextHsv)
    setDraftHsv(nextHsv)
  }, [value])

  const committedHex = hsvToHex(committedHsv)
  const draftHex = hsvToHex(draftHsv)
  const hueHex = hsvToHex({ h: draftHsv.h, s: 1, v: 1 })
  const hasChanges = committedHex !== draftHex

  function resetDraft() {
    setDraftHsv(committedHsv)
  }

  function updateFromArea(clientX: number, clientY: number) {
    const area = areaRef.current
    if (!area) return

    const rect = area.getBoundingClientRect()
    const x = clamp((clientX - rect.left) / rect.width, 0, 1)
    const y = clamp((clientY - rect.top) / rect.height, 0, 1)

    setDraftHsv((current) => ({
      ...current,
      s: x,
      v: 1 - y,
    }))
  }

  React.useEffect(() => {
    if (!isDraggingArea) return

    function handleMove(event: MouseEvent) {
      updateFromArea(event.clientX, event.clientY)
    }

    function handleUp() {
      setIsDraggingArea(false)
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)

    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [isDraggingArea])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDraft()
    }
    setOpen(nextOpen)
  }

  function handleCancel() {
    resetDraft()
    setOpen(false)
  }

  function handleOk() {
    setCommittedHsv(draftHsv)
    onChange(draftHex)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border shadow-sm transition-shadow hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Background color ${committedHex}. Click to change.`}
          title="Change background color"
        >
          <span
            className="h-7 w-7 rounded-full border border-black/10"
            style={{ backgroundColor: committedHex }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[280px] p-3">
        <div
          ref={areaRef}
          className="relative h-40 w-full cursor-crosshair overflow-hidden rounded-sm"
          style={{ backgroundColor: hueHex }}
          onMouseDown={(event) => {
            setIsDraggingArea(true)
            updateFromArea(event.clientX, event.clientY)
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black to-transparent" />
          <div
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30"
            style={{
              left: `${draftHsv.s * 100}%`,
              top: `${(1 - draftHsv.v) * 100}%`,
              backgroundColor: draftHex,
            }}
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-8 w-8 shrink-0 rounded-full border border-border shadow-sm"
            style={{ backgroundColor: draftHex }}
            aria-hidden
          />

          <div className="relative min-w-0 flex-1">
            <div
              className="h-3 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
            />
            <input
              type="range"
              min={0}
              max={360}
              value={Math.round(draftHsv.h)}
              onChange={(event) =>
                setDraftHsv((current) => ({
                  ...current,
                  h: Number(event.target.value),
                }))
              }
              className="absolute inset-0 h-3 w-full cursor-pointer opacity-0"
              aria-label="Hue"
            />
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30"
              style={{
                left: `${(draftHsv.h / 360) * 100}%`,
                backgroundColor: hueHex,
              }}
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "border bg-background hover:bg-muted"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOk}
            disabled={!hasChanges}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity",
              "bg-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            OK
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

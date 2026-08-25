"use client"

import { useState } from "react"
import { Eye } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function FlyerThumbnail({
  src,
  alt = "Flyer",
  className,
}: {
  src: string
  alt?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          "group relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-lg border bg-muted text-left shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        aria-label={`View ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100">
          <span className="flex size-10 items-center justify-center rounded-full bg-white text-slate-800 shadow">
            <Eye className="size-5" aria-hidden />
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[95vh] w-auto max-w-[min(96vw,56rem)] border-none bg-transparent p-0 shadow-none [&_[data-slot=dialog-close]]:bg-black/60 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:opacity-100"
          showCloseButton
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">
            Full-size flyer preview
          </DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="mx-auto max-h-[88vh] w-auto max-w-full rounded-md object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

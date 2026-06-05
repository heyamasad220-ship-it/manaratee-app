"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { updateProgramStatus } from "@/lib/programs/program-catalog-actions"
import {
  getProgramStatusLabel,
  type ProgramStatus,
} from "@/lib/programs/program-status"

const STATUS_OPTIONS: ProgramStatus[] = [
  "draft",
  "active",
  "paused",
  "archived",
]

export function ProgramStatusSelect({
  programId,
  status,
  className,
}: {
  programId: string
  status: ProgramStatus
  className?: string
}) {
  const router = useRouter()
  const [value, setValue] = React.useState(status)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setValue(status)
  }, [status])

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as ProgramStatus
    const previousStatus = value

    setValue(nextStatus)
    setError(null)
    setIsUpdating(true)

    try {
      const result = await updateProgramStatus(programId, nextStatus)

      if (!result.success) {
        setValue(previousStatus)
        setError(result.error)
        return
      }

      router.refresh()
    } catch {
      setValue(previousStatus)
      setError("Failed to update status.")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className={cn("relative shrink-0", className)}>
      <select
        value={value}
        onChange={(event) => void handleChange(event)}
        disabled={isUpdating}
        aria-label="Program status"
        className={cn(
          "h-7 appearance-none rounded-md border bg-background pl-2 pr-7 text-xs font-medium",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isUpdating && "opacity-70"
        )}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {getProgramStatusLabel(option)}
          </option>
        ))}
      </select>
      {isUpdating ? (
        <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          ▾
        </span>
      )}
      {error ? (
        <p className="absolute right-0 top-full z-10 mt-1 max-w-48 text-right text-[10px] text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

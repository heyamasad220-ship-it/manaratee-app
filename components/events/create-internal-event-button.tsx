"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"

import { FacilityEventRequestDrawer } from "@/components/events/facility-event-request-drawer"
import { Button } from "@/components/ui/button"
import { CREATE_EVENT_CTA_LABEL } from "@/lib/events/facility-event-request-href"
import { getInternalEventCreateFormOptionsAction } from "@/lib/events/internal-event-form-options-actions"
import type { InternalEventCreateFormOptions } from "@/lib/events/internal-event-form-options"
import { cn } from "@/lib/utils"

type CreateInternalEventButtonProps = {
  departmentId?: string | null
  lockDepartment?: boolean
  campaignId?: string | null
  initialOpen?: boolean
  initialDate?: string | null
  onSubmitted?: (eventId: string) => void
  size?: "sm" | "default"
  variant?: "default" | "outline"
  className?: string
}

export function CreateInternalEventButton({
  departmentId = null,
  lockDepartment = false,
  campaignId = null,
  initialOpen = false,
  initialDate = null,
  onSubmitted,
  size = "sm",
  variant = "default",
  className,
}: CreateInternalEventButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<InternalEventCreateFormOptions | null>(
    null
  )

  const calendarReturnTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : pathname

  async function loadOptions() {
    if (options) return options
    setLoading(true)
    setError(null)
    const result = await getInternalEventCreateFormOptionsAction({
      departmentId,
    })
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      return null
    }
    setOptions(result.options)
    return result.options
  }

  async function openDrawer() {
    const loaded = await loadOptions()
    if (loaded) setOpen(true)
  }

  useEffect(() => {
    if (!initialOpen) return
    void openDrawer()
    // Open once when the page is loaded with ?create=1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpen])

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(className)}
        onClick={() => void openDrawer()}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        {CREATE_EVENT_CTA_LABEL}
      </Button>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      {options ? (
        <FacilityEventRequestDrawer
          open={open}
          onOpenChange={setOpen}
          departments={options.departments}
          eventTypes={options.eventTypes}
          venues={options.venues}
          setupStyles={options.setupStyles}
          canManageSetupStyles={false}
          defaults={{
            departmentId: departmentId || options.defaults.departmentId,
            user: options.defaults.user,
          }}
          lockDepartment={lockDepartment}
          initialSlot={
            initialDate ? { startAt: `${initialDate}T09:00:00` } : null
          }
          spaceMode="calendar-link"
          linkedCampaignId={campaignId}
          approvalRequired={options.approvalRequired}
          calendarReturnTo={calendarReturnTo}
          calendarDepartmentId={departmentId}
          onSubmitted={(eventId) => {
            setOpen(false)
            onSubmitted?.(eventId)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}

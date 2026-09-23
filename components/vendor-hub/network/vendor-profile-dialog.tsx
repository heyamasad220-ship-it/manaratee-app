"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VendorProfileClient } from "@/components/vendor-hub/network/vendor-profile-client"
import { contactProfilePath } from "@/lib/vendor-hub/contact-centric-model"
import { getVendorProfileAction } from "@/lib/vendor-hub/vendor-profile-actions"
import type { VendorProfileData } from "@/lib/vendor-hub/vendor-profile-queries"

export type VendorProfileListUpdate = {
  contactId: string
  contactName: string
  email: string
  phone: string
  businessName: string
  vendorTypeId: string | null
  vendorTypeName: string | null
}

function toListUpdate(profile: VendorProfileData): VendorProfileListUpdate {
  return {
    contactId: profile.contactId,
    contactName: profile.contactName,
    email: profile.email,
    phone: profile.phone,
    businessName: profile.businessName,
    vendorTypeId: profile.vendorTypeId,
    vendorTypeName: profile.vendorTypeName,
  }
}

export function VendorProfileDialog({
  contactId,
  open,
  onOpenChange,
  onUpdated,
}: {
  contactId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: (update: VendorProfileListUpdate) => void
}) {
  const [profile, setProfile] = useState<VendorProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !contactId) {
      setProfile(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setProfile(null)

    void getVendorProfileAction(contactId).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setProfile(null)
      } else {
        setProfile(result.profile)
        setError(null)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [contactId, open])

  const reload = useCallback(() => {
    if (!contactId) return
    void getVendorProfileAction(contactId).then((result) => {
      if (!result.success) return
      setProfile(result.profile)
      onUpdated?.(toListUpdate(result.profile))
    })
  }, [contactId, onUpdated])

  const title = profile?.businessName || "Vendor profile"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,52rem)] w-[min(72rem,calc(100vw-2rem))] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          {profile ? (
            <DialogDescription>
              Primary contact:{" "}
              <Link
                href={contactProfilePath(profile.contactId)}
                className="text-primary hover:underline"
              >
                {profile.primaryContactName}
              </Link>
            </DialogDescription>
          ) : (
            <DialogDescription>Business and contact details for this vendor.</DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading vendor...
            </div>
          ) : error ? (
            <p className="py-8 text-sm text-destructive">{error}</p>
          ) : profile ? (
            <VendorProfileClient
              profile={profile}
              presentation="dialog"
              onRefresh={reload}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

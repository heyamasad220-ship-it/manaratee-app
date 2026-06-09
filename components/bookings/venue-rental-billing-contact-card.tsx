"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2, Search, User, X } from "lucide-react"

import { updateVenueRentalBillingContact } from "@/lib/bookings/venue-rental-actions"
import { fetchContactsList } from "@/lib/contacts/contact-list-actions"
import type { VenueRentalQueueRow } from "@/lib/bookings/venue-rental-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type VenueRentalBillingContactCardProps = {
  rentalId: string
  billingContactId: string | null
  billingContactName: string | null
  billingContactType: VenueRentalQueueRow["billingContactType"]
  canManage: boolean
}

export function VenueRentalBillingContactCard({
  rentalId,
  billingContactId,
  billingContactName,
  billingContactType,
  canManage,
}: VenueRentalBillingContactCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [options, setOptions] = useState<
    Array<{ id: string; name: string; primaryContactName: string }>
  >([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const loadOptions = useCallback(async () => {
    if (!canManage || !debouncedSearch.trim()) {
      setOptions([])
      return
    }

    setLoadingOptions(true)
    try {
      const result = await fetchContactsList({
        search: debouncedSearch.trim(),
        lockedRecordType: "organization",
        page: 1,
        pageSize: 8,
      })
      setOptions(
        result.contacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          primaryContactName: contact.primaryContactName,
        }))
      )
    } catch (loadError) {
      console.error(loadError)
      setOptions([])
    } finally {
      setLoadingOptions(false)
    }
  }, [canManage, debouncedSearch])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  function assignContact(contactId: string) {
    setError(null)
    startTransition(async () => {
      try {
        await updateVenueRentalBillingContact({
          venueRentalId: rentalId,
          billingContactId: contactId,
        })
        setDebouncedSearch("")
        setSearchQuery("")
        router.refresh()
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : "Could not update billing contact."
        )
      }
    })
  }

  function clearContact() {
    setError(null)
    startTransition(async () => {
      try {
        await updateVenueRentalBillingContact({
          venueRentalId: rentalId,
          billingContactId: null,
        })
        router.refresh()
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : "Could not clear billing contact."
        )
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Billing Organization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {billingContactId ? (
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              {billingContactType === "organization" ? (
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              ) : (
                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{billingContactName || "Contact"}</p>
                <Button variant="link" className="h-auto p-0 text-sm" asChild>
                  <Link href={`/contacts/${billingContactId}`}>View contact profile</Link>
                </Button>
              </div>
            </div>
            {canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={clearContact}
                aria-label="Clear billing contact"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No organization linked yet. Assign one to track rental history on the org contact
            profile.
          </p>
        )}

        {canManage ? (
          <div className="space-y-2">
            <Label htmlFor="billing-org-search">Link organization contact</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="billing-org-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organizations..."
                className="pl-9"
              />
            </div>
            {loadingOptions ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            ) : null}
            {options.length > 0 ? (
              <div className="rounded-md border">
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50"
                    disabled={isPending || option.id === billingContactId}
                    onClick={() => assignContact(option.id)}
                  >
                    <div>
                      <p className="font-medium">{option.name}</p>
                      {option.primaryContactName ? (
                        <p className="text-xs text-muted-foreground">
                          Contact: {option.primaryContactName}
                        </p>
                      ) : null}
                    </div>
                    {option.id === billingContactId ? (
                      <span className="text-xs text-muted-foreground">Linked</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  )
}

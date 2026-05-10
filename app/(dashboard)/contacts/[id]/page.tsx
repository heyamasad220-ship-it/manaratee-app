"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  ArrowLeft,
  Building2,
  Calendar,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Store,
  User,
  Users,
  Wrench,
} from "lucide-react"

type ContactRole = "customer" | "volunteer" | "vendor" | "service_provider" | "donor"

const roleLabels: Record<ContactRole, string> = {
  customer: "Customer",
  volunteer: "Volunteer",
  vendor: "Vendor",
  service_provider: "Service Provider",
  donor: "Donor",
}

const roleColors: Record<ContactRole, string> = {
  customer: "bg-blue-100 text-blue-700",
  volunteer: "bg-emerald-100 text-emerald-700",
  vendor: "bg-amber-100 text-amber-700",
  service_provider: "bg-purple-100 text-purple-700",
  donor: "bg-rose-100 text-rose-700",
}

function formatText(value: string | null | undefined) {
  if (!value) return "-"

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString()
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleString()
}

function formatMoney(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  })
}

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contactId = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [donations, setDonations] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [errorMessage, setErrorMessage] = useState("")

  const loadContact = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")

    const { data, error } = await supabase
      .from("contacts")
      .select(`
        id,
        full_name,
        email,
        phone,
        address,
        city,
        state,
        zip,
        country,
        contact_type,
        status,
        created_at,
        contact_roles(role)
      `)
      .eq("id", contactId)
      .single()

    if (error || !data) {
      console.error("Error loading contact:", error)
      setContact(null)
      setErrorMessage(error?.message || "This contact could not be found.")
      setLoading(false)
      return
    }

    setContact(data)

    const roles = data.contact_roles || []
    const isDonor = roles.some((role: any) => role.role === "donor")

    if (isDonor && data.full_name) {
      const { data: donorMatches, error: donorError } = await supabase
        .from("donors")
        .select("id")
        .ilike("full_name", data.full_name)

      if (donorError) {
        console.error("Error finding donor matches:", donorError)
      }

      const donorIds = (donorMatches || []).map((d: any) => d.id)

      if (donorIds.length > 0) {
        const { data: paymentData, error: paymentError } = await supabase
          .from("payments")
          .select(`
            id,
            amount,
            payment_date,
            source,
            status,
            memo
          `)
          .in("donor_id", donorIds)
          .order("payment_date", { ascending: false })

        if (paymentError) {
          console.error("Error loading payments:", paymentError)
          setDonations([])
        } else {
          setDonations(paymentData || [])
        }
      } else {
        setDonations([])
      }
    } else {
      setDonations([])
    }

    const { data: notesData, error: notesError } = await supabase
      .from("contact_notes")
      .select(`
        id,
        note,
        created_at
      `)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })

    if (notesError) {
      console.error("Error loading notes:", notesError)
      setNotes([])
    } else {
      setNotes(notesData || [])
    }

    setLoading(false)
  }, [contactId, supabase])

  useEffect(() => {
    if (contactId) {
      loadContact()
    }
  }, [contactId, loadContact])

  const roles = useMemo(() => {
    return ((contact?.contact_roles || []) as any[])
      .map((role) => role.role)
      .filter(Boolean) as ContactRole[]
  }, [contact])

  const hasRole = useCallback(
    (roleName: ContactRole) => roles.includes(roleName),
    [roles]
  )

  const fullAddress = useMemo(() => {
    if (!contact) return "-"

    return (
      [contact.address, contact.city, contact.state, contact.zip, contact.country]
        .filter(Boolean)
        .join(", ") || "-"
    )
  }, [contact])

  if (loading) {
    return (
      <>
        <Header title="Contact" />
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading contact...
        </div>
      </>
    )
  }

  if (!contact) {
    return (
      <>
        <Header title="Contact Not Found" />
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {errorMessage || "This contact could not be found."}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => router.push("/contacts")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Contacts
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={contact.full_name || "Contact"} />

      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {contact.contact_type === "organization" ? (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h1 className="text-2xl font-bold">{contact.full_name || "Unnamed Contact"}</h1>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {formatText(contact.contact_type)}
                </p>
              </div>

              <Button variant="outline" onClick={() => router.push("/contacts")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Contacts
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {roles.length === 0 ? (
                <Badge variant="secondary">No Role</Badge>
              ) : (
                roles.map((role) => (
                  <Badge
                    key={role}
                    variant="secondary"
                    className={roleColors[role] || ""}
                  >
                    {roleLabels[role] || formatText(role)}
                  </Badge>
                ))
              )}
            </div>

            <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Email</div>
                  <div className="text-muted-foreground">{contact.email || "-"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Phone</div>
                  <div className="text-muted-foreground">{contact.phone || "-"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Created</div>
                  <div className="text-muted-foreground">{formatDate(contact.created_at)}</div>
                </div>
              </div>

              <div>
                <div className="font-medium">Status</div>
                <div className="text-muted-foreground">{formatText(contact.status)}</div>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Address</div>
                    <div className="text-muted-foreground">{fullAddress}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasRole("customer") && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Customer</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Customer details, bookings, invoices, and activity can appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {hasRole("donor") && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-600" />
                <h2 className="text-lg font-semibold">Donor History</h2>
              </div>

              {donations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No donations found.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {donations.map((donation) => (
                    <div key={donation.id} className="rounded-lg border p-4">
                      <div className="font-medium">{formatMoney(donation.amount)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(donation.payment_date)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatText(donation.source)}
                      </div>
                      {donation.memo && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          {donation.memo}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasRole("volunteer") && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">Volunteer</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Volunteer availability, assignments, hours, and event participation can appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {hasRole("vendor") && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <Store className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold">Vendor</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Vendor applications, products, approval status, booth details, and event history can appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {hasRole("service_provider") && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold">Service Provider</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Service agreements, account details, service history, invoices, and maintenance notes can appear here.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Notes</h2>

            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border p-4">
                    <div className="whitespace-pre-wrap text-sm">{note.note}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(note.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

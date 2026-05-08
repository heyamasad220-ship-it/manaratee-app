"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

export default function ContactDetailPage() {
  const params = useParams()
  const contactId = params.id as string
  const supabase = createClient()

  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [donations, setDonations] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])

  useEffect(() => {
    async function loadContact() {
      setLoading(true)

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
        setLoading(false)
        return
      }

      setContact(data)

      const { data: donorMatches, error: donorError } = await supabase
        .from("donors")
        .select("id")
        .ilike("full_name", data.full_name)

      if (donorError) {
        console.error("Error finding donor matches:", donorError)
      }

      const donorIds = (donorMatches || []).map((d) => d.id)

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
        } else {
          setDonations(paymentData || [])
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
} else {
  setNotes(notesData || [])
}

      setLoading(false)
    }

    if (contactId) {
      loadContact()
    }
  }, [contactId])

  function formatText(value: string | null | undefined) {
    if (!value) return "-"
    return value
      .replace("_", " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase())
  }

  if (loading) {
    return (
      <>
        <Header title="Contact" />
        <div className="p-6">Loading contact...</div>
      </>
    )
  }

  if (!contact) {
    return (
      <>
        <Header title="Contact Not Found" />
        <div className="p-6">This contact could not be found.</div>
      </>
    )
  }

  const roles = contact.contact_roles || []

  return (
    <>
    <Header title={contact.full_name || "Contact"} />

      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold">{contact.full_name}</h1>
    <p className="text-muted-foreground">
      {formatText(contact.contact_type)}
    </p>
  </div>

  <button
    onClick={() => window.history.back()}
    className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
  >
    Back
  </button>
</div>

            <div className="flex flex-wrap gap-2">
              {roles.map((role: any) => (
                <Badge key={role.role} variant="secondary">
                  {formatText(role.role)}
                </Badge>
              ))}
            </div>

            <div className="grid gap-3 text-sm">
              <div>
                <strong>Email:</strong> {contact.email || "-"}
              </div>
              <div>
                <strong>Phone:</strong> {contact.phone || "-"}
              </div>
              <div>
                <strong>Status:</strong> {formatText(contact.status)}
              </div>
              <div>
                <strong>Address:</strong>{" "}
                {[contact.address, contact.city, contact.state, contact.zip, contact.country]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </div>
              <div>
                <strong>Created:</strong>{" "}
                {contact.created_at
                  ? new Date(contact.created_at).toLocaleDateString()
                  : "-"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Donor History</h2>

            {donations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No donations found.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {donations.map((donation) => (
                  <div key={donation.id} className="rounded-lg border p-4">
                    <div className="font-medium">
                      ${Number(donation.amount || 0).toLocaleString()}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {donation.payment_date
                        ? new Date(donation.payment_date).toLocaleDateString()
                        : "-"}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {formatText(donation.source)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
  <CardContent className="p-6">
    <h2 className="mb-4 text-lg font-semibold">
      Notes
    </h2>

    {notes.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No notes yet.
      </p>
    ) : (
      <div className="flex flex-col gap-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className="rounded-lg border p-4"
          >
            <div className="text-sm whitespace-pre-wrap">
              {note.note}
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              {new Date(note.created_at).toLocaleString()}
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
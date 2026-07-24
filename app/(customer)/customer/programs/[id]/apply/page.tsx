import Link from "next/link"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { ProgramApplyForm } from "@/components/customer/program-apply-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { resolveCustomerPortalSession } from "@/lib/auth/customer-portal-session"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"
import { getApplicationsForRegistrantContact } from "@/lib/programs/program-application-actions"
import {
  PROGRAM_APPLICANT_TYPE_LABELS,
  PROGRAM_APPLICATION_STATUS_LABELS,
} from "@/lib/programs/program-application-types"
import { getCustomerOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import {
  getCustomerContactForUser,
  lookupContactsByPersonIds,
} from "@/lib/programs/registration-contact-resolver"
import { createClient } from "@/lib/supabase/server"

type CustomerOrganization = {
  organization_id: string
  organization_name: string
  role_name: string
}

async function getFamilyMemberOptions(
  parentPersonId: string,
  organizationId: string,
  registrant: { id: string; full_name: string | null }
): Promise<Array<{ contactId: string; name: string }>> {
  const supabase = await createClient()
  const options: Array<{ contactId: string; name: string }> = [
    {
      contactId: registrant.id,
      name: registrant.full_name?.trim() || "Me",
    },
  ]

  const { data: relationships, error } = await supabase
    .from("person_relationships")
    .select("related_person_id")
    .eq("organization_id", organizationId)
    .eq("person_id", parentPersonId)

  if (error || !relationships?.length) {
    return options
  }

  const personIds = relationships.map((row) => row.related_person_id as string)
  const { data: people } = await supabase
    .from("people")
    .select("id, first_name, last_name")
    .eq("organization_id", organizationId)
    .in("id", personIds)

  const contactByPersonId = await lookupContactsByPersonIds(
    organizationId,
    personIds
  )

  for (const person of people || []) {
    const contactId = contactByPersonId.get(person.id as string)
    if (!contactId || contactId === registrant.id) continue
    const name = [person.first_name, person.last_name]
      .filter(Boolean)
      .join(" ")
      .trim()
    options.push({
      contactId,
      name: name || "Family member",
    })
  }

  return options
}

export default async function ProgramApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ offering?: string }>
}) {
  const { id: programId } = await params
  const { offering: offeringParam } = await searchParams

  const cookieStore = await cookies()
  const organizations = (await getMyOrganizations()) as CustomerOrganization[]
  const selectedOrganizationId = cookieStore.get("active_organization_id")?.value
  const organizationId =
    selectedOrganizationId &&
    organizations.some((org) => org.organization_id === selectedOrganizationId)
      ? selectedOrganizationId
      : organizations[0]?.organization_id

  if (!organizationId) {
    notFound()
  }

  const session = await resolveCustomerPortalSession()
  if (!session?.effectiveUserId) {
    notFound()
  }

  const supabase = await createClient()
  const { data: program } = await supabase
    .from("programs")
    .select("id, name, organization_id, status")
    .eq("id", programId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!program) {
    notFound()
  }

  const customerContact = await getCustomerContactForUser(
    organizationId,
    session.effectiveUserId
  )

  if (!customerContact?.id) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/customer/programs/${programId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Contact required</CardTitle>
            <CardDescription>
              Link your account to a contact before applying to a program.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [offerings, applications, familyMembers] = await Promise.all([
    getCustomerOfferingsForProgram(programId, organizationId),
    getApplicationsForRegistrantContact(
      organizationId,
      customerContact.id,
      programId
    ),
    customerContact.person_id
      ? getFamilyMemberOptions(
          customerContact.person_id,
          organizationId,
          customerContact
        )
      : Promise.resolve([
          {
            contactId: customerContact.id,
            name: customerContact.full_name?.trim() || "Me",
          },
        ]),
  ])

  const openOfferings = offerings.filter(
    (offering) => offering.status === "active" || offering.status === "closed"
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/customer/programs/${programId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to program
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Apply · {program.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us if the student is returning or new. All applications are
            reviewed by the department before registration.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
          <CardDescription>
            Approval comes before registration and fees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgramApplyForm
            organizationId={organizationId}
            programId={programId}
            userId={session.effectiveUserId}
            registrantContactId={customerContact.id}
            offerings={openOfferings}
            initialOfferingId={offeringParam}
            familyMembers={familyMembers}
          />
        </CardContent>
      </Card>

      {applications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your applications</CardTitle>
            <CardDescription>
              Status for this program. Register when approved and a seat is
              open.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {applications.map((application) => (
              <div
                key={application.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {application.participant_name}
                    {application.offering_name
                      ? ` · ${application.offering_name}`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {
                      PROGRAM_APPLICANT_TYPE_LABELS[
                        application.applicant_type
                      ]
                    }
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {
                      PROGRAM_APPLICATION_STATUS_LABELS[
                        application.status
                      ]
                    }
                  </Badge>
                  {application.status === "approved" ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/customer/programs/${programId}/register?offering=${
                          application.approved_offering_id ||
                          application.offering_id
                        }`}
                      >
                        Register
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

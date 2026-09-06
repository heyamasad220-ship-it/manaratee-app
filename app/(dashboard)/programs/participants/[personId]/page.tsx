import { notFound, redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { ParticipantProfileClient } from "@/components/programs/participant-profile-client"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isSafeReturnToPath } from "@/lib/navigation/return-to"
import { canAccessParticipantPerson } from "@/lib/programs/program-access"
import { getParticipantProfileData } from "@/lib/programs/participant-profile-queries"

export default async function ParticipantProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { personId } = await params
  if (!(await canAccessParticipantPerson(personId))) {
    redirect("/unauthorized")
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    redirect("/unauthorized")
  }

  const resolvedSearchParams = await searchParams
  const returnTo = isSafeReturnToPath(resolvedSearchParams.returnTo)
    ? resolvedSearchParams.returnTo
    : null

  const data = await getParticipantProfileData({
    organizationId,
    personId,
  })

  if (!data) {
    notFound()
  }

  return (
    <>
      <Header title="Participant" />
      <ParticipantProfileClient data={data} returnTo={returnTo} />
    </>
  )
}

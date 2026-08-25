import { redirect } from "next/navigation"

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

/**
 * Legacy department offering URL → Programs module.
 */
export default async function DepartmentProgramOfferingManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; programId: string; offeringId: string }>
  searchParams?: Promise<{ tab?: string; edit?: string; session?: string }>
}) {
  const { programId, offeringId } = await params
  const resolved = searchParams ? await searchParams : {}
  const query = new URLSearchParams()
  if (firstValue(resolved.edit) === "1") query.set("edit", "1")
  const session = firstValue(resolved.session)?.trim()
  if (session) query.set("session", session)
  const suffix = query.toString()
  redirect(
    suffix
      ? `/programs/${programId}/offerings/${offeringId}?${suffix}`
      : `/programs/${programId}/offerings/${offeringId}`
  )
}

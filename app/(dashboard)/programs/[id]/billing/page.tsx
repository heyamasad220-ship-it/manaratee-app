import { redirect } from "next/navigation"

export default async function ProgramBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ offering?: string }>
}) {
  const { id } = await params
  const { offering: offeringParam } = await searchParams

  const query = new URLSearchParams({
    tab: "offerings",
    workspaceTab: "pricing",
  })

  if (offeringParam) {
    query.set("offering", offeringParam)
  }

  redirect(`/programs/${id}/edit?${query.toString()}`)
}

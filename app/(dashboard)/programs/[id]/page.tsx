import { redirect } from "next/navigation"

export default async function ProgramDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/programs/${id}/edit`)
}

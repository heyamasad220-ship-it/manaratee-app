import { redirect } from "next/navigation"

/** Legacy family URL — households now live under Directory → Families. */
export default async function ContactFamilyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/directory/families/${id}`)
}

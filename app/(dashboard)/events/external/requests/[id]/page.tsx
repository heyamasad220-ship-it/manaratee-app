import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ExternalRequestDetailRedirectPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/bookings/rentals/${id}`)
}

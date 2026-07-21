import { DonationGroupDetailClient } from "@/components/donations/donation-group-detail-client"

export default async function DonationGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <DonationGroupDetailClient groupId={id} />
}

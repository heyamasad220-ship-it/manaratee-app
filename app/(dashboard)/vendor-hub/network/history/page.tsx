import { ParticipationHistoryClient } from "@/components/vendor-hub/network/participation-history-client"
import { getParticipationHistory } from "@/lib/vendor-hub/participation-history-queries"

export default async function VendorNetworkHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>
}) {
  const { contact } = await searchParams
  const rows = await getParticipationHistory(contact ?? null)

  return <ParticipationHistoryClient rows={rows} contactIdFilter={contact ?? null} />
}

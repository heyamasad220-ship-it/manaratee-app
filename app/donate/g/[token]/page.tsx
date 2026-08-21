import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CampaignGroupDonateForm } from "@/components/donations/campaign-group-donate-form"
import { getPublicCampaignGroupDonateInfoAction } from "@/lib/donations/campaign-group-public-actions"

type PageProps = {
  params: Promise<{ token: string }>
}

/**
 * Public campaign group donation page.
 * Stripe Checkout → webhook writes one payment with campaign_id + campaign_group_id.
 */
export default async function CampaignGroupDonatePage({ params }: PageProps) {
  const { token } = await params
  if (!token?.trim()) notFound()

  const result = await getPublicCampaignGroupDonateInfoAction(token)
  if (!result.success) {
    if (/not found/i.test(result.error)) notFound()
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-semibold">Donation link unavailable</h1>
        <p className="text-muted-foreground">{result.error}</p>
      </main>
    )
  }

  const { info } = result

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center gap-6 p-6">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {info.organizationName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{info.campaignName}</h1>
        <p className="text-lg text-muted-foreground">
          Supporting <span className="font-medium text-foreground">{info.groupName}</span>
        </p>
      </div>

      {info.description ? (
        <p className="text-center text-sm text-muted-foreground">{info.description}</p>
      ) : null}

      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
        <CampaignGroupDonateForm info={info} />
      </Suspense>
    </main>
  )
}

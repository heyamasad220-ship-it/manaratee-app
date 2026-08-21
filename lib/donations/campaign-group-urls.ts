import { getAppBaseUrl } from "@/lib/app/get-app-base-url"
import { buildCampaignGroupDonationPath } from "@/lib/donations/campaign-group-types"

export function buildCampaignGroupDonationUrl(publicToken: string, baseUrl?: string) {
  const root = (baseUrl ?? getAppBaseUrl()).replace(/\/$/, "")
  return `${root}${buildCampaignGroupDonationPath(publicToken)}`
}

export function buildCampaignGroupQrImageUrl(donationUrl: string, size = 256) {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data: donationUrl,
  })
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`
}

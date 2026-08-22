import { getAppBaseUrl } from "@/lib/app/get-app-base-url"
import { buildWishlistDonationPath } from "@/lib/donations/campaign-wishlist-types"
import { buildCampaignGroupQrImageUrl } from "@/lib/donations/campaign-group-urls"

export function buildWishlistDonationUrl(publicToken: string, baseUrl?: string) {
  const root = (baseUrl ?? getAppBaseUrl()).replace(/\/$/, "")
  return `${root}${buildWishlistDonationPath(publicToken)}`
}

export function buildWishlistQrImageUrl(donationUrl: string, size = 256) {
  return buildCampaignGroupQrImageUrl(donationUrl, size)
}

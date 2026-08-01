import { VenueRentalDiscountsClient } from "@/components/bookings/venue-rental-discounts-client"
import { getVenueRentalDiscountPoliciesForSettings } from "@/lib/bookings/venue-rental-queries"
import { getDiscountTags } from "@/lib/discount-tags/discount-tag-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function VenueRentalDiscountsSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const [policies, tags] = await Promise.all([
    getVenueRentalDiscountPoliciesForSettings(),
    getDiscountTags(),
  ])

  return (
    <VenueRentalDiscountsClient
      policies={policies}
      discountTags={tags
        .filter((tag) => tag.active)
        .map((tag) => ({ id: tag.id, name: tag.name }))}
    />
  )
}

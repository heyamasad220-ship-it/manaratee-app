import { isDonationFundActive } from "@/lib/donations/donation-fund-status"
import {
  donationAttributionNamesMatch,
  findGeneralDonationCategory,
} from "@/lib/donations/donation-default-attribution"

export type CustomerDonationCategoryOption = {
  id: string
  name: string
  funds: Array<{
    id: string
    name: string
    category_id: string
  }>
}

const UNRESTRICTED_GIVING_CATEGORY_NAME = "Unrestricted Giving"

/** True when the donor must pick one of the category's open funds before giving. */
export function customerDonationCategoryRequiresFund(
  category: Pick<CustomerDonationCategoryOption, "funds">
): boolean {
  return category.funds.length > 0
}

export function buildCustomerOpenDonationCategories(
  categories: Array<{ id: string; name: string }>,
  subcategories: Array<{
    id: string
    name: string
    category_id: string
    is_active?: boolean | null
  }>
): CustomerDonationCategoryOption[] {
  const activeSubcategories = subcategories.filter((fund) =>
    isDonationFundActive(fund.is_active)
  )

  const openCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    funds: activeSubcategories
      .filter((fund) => fund.category_id === category.id)
      .map((fund) => ({
        id: fund.id,
        name: fund.name,
        category_id: fund.category_id,
      })),
  }))

  if (!findGeneralDonationCategory(openCategories)) {
    return openCategories
  }

  return openCategories.filter(
    (category) =>
      !donationAttributionNamesMatch(category.name, UNRESTRICTED_GIVING_CATEGORY_NAME)
  )
}

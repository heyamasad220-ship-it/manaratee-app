import { isDonationFundActive } from "@/lib/donations/donation-fund-status"

export type CustomerDonationCategoryOption = {
  id: string
  name: string
  funds: Array<{
    id: string
    name: string
    category_id: string
  }>
}

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

  return categories.map((category) => ({
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
}

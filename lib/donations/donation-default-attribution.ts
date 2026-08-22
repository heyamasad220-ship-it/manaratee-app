export const GENERAL_DONATION_CATEGORY_NAME = "General Donation"
export const GENERAL_FUND_NAME = "General Fund"

export function donationAttributionNamesMatch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

export function findGeneralDonationCategory<T extends { id: string; name: string }>(
  categories: T[]
): T | null {
  return (
    categories.find((category) =>
      donationAttributionNamesMatch(category.name, GENERAL_DONATION_CATEGORY_NAME)
    ) ?? null
  )
}

export function findGeneralFund<
  T extends { id: string; name: string; categoryId: string; isActive?: boolean },
>(funds: T[], categoryId?: string | null): T | null {
  const matches = funds.filter(
    (fund) =>
      donationAttributionNamesMatch(fund.name, GENERAL_FUND_NAME) &&
      fund.isActive !== false
  )
  if (categoryId) {
    return matches.find((fund) => fund.categoryId === categoryId) ?? matches[0] ?? null
  }
  return matches[0] ?? null
}

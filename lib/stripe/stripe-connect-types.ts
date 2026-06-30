export type OrganizationStripeConnectStatus = {
  stripeConnectAccountId: string | null
  stripeConnectChargesEnabled: boolean
  stripeConnectPayoutsEnabled: boolean
  stripeConnectDetailsSubmitted: boolean
  stripeConnectOnboardedAt: string | null
}

export function isOrganizationStripeConnectReady(
  status: OrganizationStripeConnectStatus
): boolean {
  return Boolean(
    status.stripeConnectAccountId &&
      status.stripeConnectChargesEnabled &&
      status.stripeConnectDetailsSubmitted
  )
}

export function mapOrganizationStripeConnectRow(
  row: Record<string, unknown> | null | undefined
): OrganizationStripeConnectStatus {
  return {
    stripeConnectAccountId: (row?.stripe_connect_account_id as string | null) ?? null,
    stripeConnectChargesEnabled: Boolean(row?.stripe_connect_charges_enabled),
    stripeConnectPayoutsEnabled: Boolean(row?.stripe_connect_payouts_enabled),
    stripeConnectDetailsSubmitted: Boolean(row?.stripe_connect_details_submitted),
    stripeConnectOnboardedAt: (row?.stripe_connect_onboarded_at as string | null) ?? null,
  }
}

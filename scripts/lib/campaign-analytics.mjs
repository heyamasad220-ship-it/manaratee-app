/** Script mirror of lib/donations/campaign-analytics.ts (compute helpers only). */

export function isActivePledgeStatus(status) {
  return String(status || "").toLowerCase() !== "cancelled"
}

export function isVoidedPayment(status) {
  return String(status || "").toLowerCase() === "voided"
}

export function buildPledgeCampaignMap(pledges) {
  return new Map(pledges.map((pledge) => [pledge.id, pledge.campaign_id]))
}

export function resolvePaymentCampaignId(payment, pledgeCampaignById) {
  if (payment.campaign_id) return payment.campaign_id
  if (payment.pledge_id) return pledgeCampaignById.get(payment.pledge_id) ?? null
  return null
}

export function filterPaymentsForCampaign(campaignId, payments, pledgeCampaignById) {
  return payments.filter((payment) => {
    const resolved = resolvePaymentCampaignId(payment, pledgeCampaignById)
    return resolved === campaignId && !isVoidedPayment(payment.status)
  })
}

export function filterPledgesForCampaign(campaignId, pledges) {
  return pledges.filter(
    (pledge) =>
      pledge.campaign_id === campaignId && isActivePledgeStatus(pledge.calculated_status)
  )
}

export function computeCampaignMetrics(
  campaignId,
  goalAmount,
  pledges,
  payments,
  pledgeCampaignById
) {
  const campaignPledges = filterPledgesForCampaign(campaignId, pledges)
  const campaignPledgeIds = new Set(campaignPledges.map((pledge) => pledge.id))
  const campaignPayments = filterPaymentsForCampaign(campaignId, payments, pledgeCampaignById)

  const raised = campaignPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const pledged = campaignPledges.reduce(
    (sum, pledge) => sum + Number(pledge.amount_pledged || 0),
    0
  )
  const collectedAgainstPledges = campaignPayments
    .filter((payment) => payment.pledge_id && campaignPledgeIds.has(payment.pledge_id))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const outstanding = campaignPledges.reduce(
    (sum, pledge) => sum + Math.max(Number(pledge.balance_remaining || 0), 0),
    0
  )
  const totalCommitted = raised + outstanding

  const goal = Number(goalAmount || 0)
  const progressPercent = goal > 0 ? Math.min((raised / goal) * 100, 100) : null

  const donorKeys = new Set()
  for (const payment of campaignPayments) {
    if (payment.donor_id) donorKeys.add(`donor:${payment.donor_id}`)
    else if (payment.contact_id) donorKeys.add(`contact:${payment.contact_id}`)
    else if (payment.sender_name) donorKeys.add(`sender:${payment.sender_name}`)
  }
  for (const pledge of campaignPledges) {
    if (pledge.donor_id) donorKeys.add(`donor:${pledge.donor_id}`)
  }

  const paymentCount = campaignPayments.length
  const amounts = campaignPayments.map((payment) => Number(payment.amount || 0))
  const largestGift = amounts.length ? Math.max(...amounts) : 0
  const averageGift = paymentCount > 0 ? raised / paymentCount : 0

  return {
    campaignId,
    raised,
    pledged,
    collectedAgainstPledges,
    outstanding,
    totalCommitted,
    progressPercent,
    donorCount: donorKeys.size,
    paymentCount,
    averageGift,
    largestGift,
  }
}

export function buildCampaignAnalytics(campaigns, pledges, payments) {
  const pledgeCampaignById = buildPledgeCampaignMap(pledges)
  return campaigns.map((campaign) => ({
    campaign,
    metrics: computeCampaignMetrics(
      campaign.id,
      campaign.goal_amount,
      pledges,
      payments,
      pledgeCampaignById
    ),
  }))
}

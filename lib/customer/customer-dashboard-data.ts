import { isCustomerPortalModuleEnabled } from "@/lib/customer/customer-portal-modules"
import { loadCustomerPortalEnabledModuleSlugs } from "@/lib/customer/customer-portal-modules-server"
import { loadCustomerDonationPortalData } from "@/lib/customer/customer-portal-data-actions"
import {
  isOutstandingPledgeStatus,
  normalizePaymentStatus,
} from "@/lib/donations/donation-status"
import {
  pledgeHasPaymentPlan,
  suggestedPledgePaymentAmount,
} from "@/lib/donations/pledge-payment-plan"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import type { CustomerDashboardCampaign } from "@/components/customer/customer-dashboard-campaigns"
import {
  CUSTOMER_DASHBOARD_ACTIVITY_LIMIT,
  CUSTOMER_DASHBOARD_FEATURED_CAMPAIGN_LIMIT,
  type CustomerDashboardActivityItem,
  type CustomerDashboardAttentionItem,
  type CustomerDashboardPageData,
} from "@/lib/customer/customer-dashboard-types"

export type {
  CustomerDashboardActivityItem,
  CustomerDashboardAttentionItem,
  CustomerDashboardPageData,
  CustomerDashboardSummaryCard,
} from "@/lib/customer/customer-dashboard-types"
export {
  CUSTOMER_DASHBOARD_ACTIVITY_LIMIT,
  CUSTOMER_DASHBOARD_FEATURED_CAMPAIGN_LIMIT,
} from "@/lib/customer/customer-dashboard-types"

function todayDateOnly() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function dateOnly(value?: string | null) {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null
  return raw.slice(0, 10)
}

function formatDueDate(value?: string | null) {
  const raw = dateOnly(value)
  if (!raw) return null
  const date = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatActivityDate(value?: string | null) {
  const raw = dateOnly(value)
  if (!raw) return "Date unavailable"
  const date = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(date.getTime())) return raw
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  if (date.getFullYear() !== new Date().getFullYear()) {
    options.year = "numeric"
  }
  return date.toLocaleDateString("en-US", options)
}

function isImportLedgerMemo(memo?: string | null) {
  const value = String(memo || "").trim()
  if (!value) return false
  return /^MAS(_CAMPAIGN_LEDGER)?(_V\d+)?\|/i.test(value) || /^MAS\|/i.test(value)
}

function resolvePaymentLabel(
  payment: {
    campaign_id?: string | null
    category_id?: string | null
    subcategory_id?: string | null
    memo?: string | null
  },
  categories: Array<{
    id: string
    name: string
    funds: Array<{ id: string; name: string }>
  }>,
  campaigns: Array<{ id: string; name: string }>
) {
  if (payment.campaign_id) {
    const campaign = campaigns.find((row) => row.id === payment.campaign_id)
    if (campaign?.name) return campaign.name
  }

  if (payment.subcategory_id) {
    for (const category of categories) {
      const fund = category.funds.find((item) => item.id === payment.subcategory_id)
      if (fund?.name) return fund.name
    }
  }

  if (payment.category_id) {
    const category = categories.find((item) => item.id === payment.category_id)
    if (category?.name) return category.name
  }

  if (payment.memo && !isImportLedgerMemo(payment.memo)) {
    return payment.memo
  }

  return "General Fund"
}

function campaignFeatureScore(campaign: CustomerDashboardCampaign) {
  return (campaign.goalAmount ? 2 : 0) + (campaign.description ? 1 : 0)
}

export function selectFeaturedPortalCampaigns(
  campaigns: CustomerDashboardCampaign[],
  limit = CUSTOMER_DASHBOARD_FEATURED_CAMPAIGN_LIMIT
) {
  return [...campaigns]
    .sort((left, right) => {
      const scoreDiff = campaignFeatureScore(right) - campaignFeatureScore(left)
      if (scoreDiff !== 0) return scoreDiff
      return left.name.localeCompare(right.name)
    })
    .slice(0, limit)
}

export function getCustomerDashboardSectionFlags(enabledSlugs: Set<string>) {
  const donationsEnabled = isCustomerPortalModuleEnabled(enabledSlugs, "donations")
  return {
    donationsEnabled,
    summary: donationsEnabled,
    attention: donationsEnabled,
    featuredCampaigns: donationsEnabled,
    recentActivity: donationsEnabled,
  }
}

export async function loadCustomerDashboardPageData(): Promise<CustomerDashboardPageData> {
  const empty: CustomerDashboardPageData = {
    donationsEnabled: false,
    summaryCards: [],
    attentionItems: [],
    featuredCampaigns: [],
    recentActivity: [],
  }

  const { activeOrganization } = await getActiveOrganization()
  if (!activeOrganization) return empty

  const enabledSlugs = await loadCustomerPortalEnabledModuleSlugs(
    activeOrganization.organization_id
  )
  const sections = getCustomerDashboardSectionFlags(enabledSlugs)

  if (!sections.donationsEnabled) {
    return empty
  }

  const result = await loadCustomerDonationPortalData()
  if (!result.ok) {
    return {
      ...empty,
      donationsEnabled: true,
    }
  }

  const campaigns: CustomerDashboardCampaign[] = (result.campaigns || []).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description ?? null,
    status: campaign.status ?? null,
    imageUrl: campaign.imageUrl ?? null,
    goalAmount: campaign.goalAmount ?? null,
    raisedAmount: campaign.raisedAmount ?? null,
  }))

  const pledges = (result.pledges || []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: String(record.id),
      campaign: String(record.campaign_name || "Campaign pledge"),
      totalAmount: Number(record.amount_pledged || 0),
      paidAmount: Number(record.amount_paid || 0),
      balance: Number(record.balance_remaining ?? 0),
      installmentAmount:
        record.installment_amount == null ? null : Number(record.installment_amount),
      totalPayments: record.total_payments == null ? null : Number(record.total_payments),
      paymentsMade: Number(record.payments_made || 0),
      frequency: String(record.frequency || "one_time"),
      firstPaymentDate: (record.first_payment_date as string | null) ?? null,
      nextPaymentDate: (record.next_payment_date as string | null) ?? null,
      pledgeDate: (record.pledge_date as string | null) ?? null,
      status: String(record.calculated_status || ""),
    }
  })

  const payments = (result.payments || []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: String(record.id),
      amount: Number(record.amount || 0),
      date: (record.payment_date as string) || "",
      status: String(record.status || ""),
      pledgeId: (record.pledge_id as string | null) ?? null,
      recurringPlanId: (record.recurring_donation_plan_id as string | null) ?? null,
      label: resolvePaymentLabel(
        {
          campaign_id: (record.campaign_id as string | null) ?? null,
          category_id: (record.category_id as string | null) ?? null,
          subcategory_id: (record.subcategory_id as string | null) ?? null,
          memo: (record.memo as string | null) ?? null,
        },
        result.categories,
        campaigns
      ),
    }
  })

  const countedPayments = payments.filter(
    (payment) => normalizePaymentStatus(payment.status) !== "voided"
  )
  const lifetimeGiving = countedPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const activePledges = pledges.filter(
    (pledge) => isOutstandingPledgeStatus(pledge.status) && pledge.balance > 0
  )
  const outstandingBalance = activePledges.reduce((sum, pledge) => sum + pledge.balance, 0)

  const today = todayDateOnly()
  const attentionItems: CustomerDashboardAttentionItem[] = activePledges.map((pledge) => {
    const hasPlan = pledgeHasPaymentPlan(pledge)
    const nextDate = dateOnly(pledge.nextPaymentDate)
    const suggestedAmount = suggestedPledgePaymentAmount({
      balance: pledge.balance,
      installmentAmount: pledge.installmentAmount,
      frequency: pledge.frequency,
      totalPayments: pledge.totalPayments,
    })
    const dueLabel = formatDueDate(nextDate)
    let description = `You have ${formatDonationCurrency(pledge.balance)} remaining on your pledge.`
    if (hasPlan && dueLabel) {
      const isPastDue = Boolean(nextDate && nextDate < today)
      description = isPastDue
        ? `${formatDonationCurrency(suggestedAmount)} payment overdue (due ${dueLabel})`
        : `${formatDonationCurrency(suggestedAmount)} payment due ${dueLabel}`
    }

    return {
      id: pledge.id,
      title: pledge.campaign,
      description,
      href: `/customer/donation?tab=pledges&pledge=${encodeURIComponent(pledge.id)}&action=pay`,
      actionLabel: "Make a Payment",
    }
  })

  const activity: CustomerDashboardActivityItem[] = [
    ...pledges.map((pledge) => ({
      id: `pledge:${pledge.id}`,
      occurredAt: dateOnly(pledge.pledgeDate) || "",
      dateLabel: formatActivityDate(pledge.pledgeDate),
      title: "Pledge created",
      subtitle: pledge.campaign,
      amountLabel: formatDonationCurrency(pledge.totalAmount),
    })),
    ...countedPayments.map((payment) => ({
      id: `payment:${payment.id}`,
      occurredAt: dateOnly(payment.date) || "",
      dateLabel: formatActivityDate(payment.date),
      title: payment.pledgeId
        ? "Pledge payment"
        : payment.recurringPlanId
          ? "Recurring donation"
          : "Donation",
      subtitle: payment.label,
      amountLabel: formatDonationCurrency(payment.amount),
    })),
  ]
    .filter((item) => item.occurredAt)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, CUSTOMER_DASHBOARD_ACTIVITY_LIMIT)

  return {
    donationsEnabled: true,
    summaryCards: [
      {
        key: "lifetime-giving",
        title: "Lifetime Giving",
        value: formatDonationCurrency(lifetimeGiving),
        href: "/customer/donation?tab=payments",
        accent: "emerald",
      },
      {
        key: "active-pledges",
        title: "Active Pledges",
        value: String(activePledges.length),
        href: "/customer/donation?tab=pledges",
        accent: "primary",
      },
      {
        key: "outstanding-balance",
        title: "Outstanding Balance",
        value: formatDonationCurrency(outstandingBalance),
        href: "/customer/donation?tab=pledges",
        accent: "amber",
      },
    ],
    attentionItems,
    featuredCampaigns: selectFeaturedPortalCampaigns(campaigns),
    recentActivity: activity,
  }
}

import { notFound } from "next/navigation"

import { PaymentDetailPageClient } from "@/components/donations/payment-detail-page-client"
import { mapPaymentToDonationHistoryRow } from "@/lib/donations/payment-admin-capabilities"
import { getPaymentDetailPageDataAction } from "@/lib/donations/payment-admin-actions"

type PageProps = {
  params: Promise<{ paymentId: string }>
}

export default async function DonationPaymentDetailPage({ params }: PageProps) {
  const { paymentId } = await params
  const result = await getPaymentDetailPageDataAction(paymentId)

  if (!result.success) {
    notFound()
  }

  const donationRow = mapPaymentToDonationHistoryRow({
    id: result.payment.id,
    amount: result.payment.amount,
    refunded_amount: result.payment.refundedAmount,
    payment_date: result.payment.paymentDate,
    source: result.payment.source,
    source_type: result.payment.sourceType,
    status: result.payment.status,
    memo: result.payment.memo,
    pledge_id: result.payment.pledgeId,
    import_batch_id: result.payment.importBatchId,
    stripe_payment_intent_id: result.payment.stripePaymentIntentId,
    stripe_charge_id: result.payment.stripeChargeId,
    donation_categories: result.payment.categoryName
      ? { name: result.payment.categoryName }
      : null,
  })

  return (
    <PaymentDetailPageClient
      paymentId={paymentId}
      initialPayment={result.payment}
      initialDonationRow={donationRow}
      donorId={result.donorId}
      contactId={result.contactId}
      donorDisplayName={result.donorDisplayName}
      canManage={result.canManage}
    />
  )
}

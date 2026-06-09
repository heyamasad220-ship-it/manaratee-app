import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { CustomerRentalContractSection } from "@/components/customer/rentals/customer-rental-contract-section"
import { CustomerRentalDocumentsSection } from "@/components/customer/rentals/customer-rental-documents-section"
import { CustomerRentalMessagesPlaceholder } from "@/components/customer/rentals/customer-rental-messages-placeholder"
import { CustomerRentalNextActionPanel } from "@/components/customer/rentals/customer-rental-next-action-panel"
import { CustomerRentalPaymentsSection } from "@/components/customer/rentals/customer-rental-payments-section"
import { CustomerRentalRentalDetailsSection } from "@/components/customer/rentals/customer-rental-details-section"
import { CustomerRentalTimeline } from "@/components/customer/rentals/customer-rental-timeline"
import { Button } from "@/components/ui/button"
import type { CustomerVenueRentalDetailDto } from "@/lib/bookings/customer-venue-rental-dtos"
import {
  getCustomerFriendlyStatusLabel,
  getCustomerRentalNextAction,
  getCustomerRentalTimelineStages,
} from "@/lib/bookings/customer-venue-rental-experience"
import { getVenueRentalCalendarColorClasses } from "@/lib/bookings/venue-rental-status"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type CustomerRentalDetailViewProps = {
  detail: CustomerVenueRentalDetailDto
}

export function CustomerRentalDetailView({ detail }: CustomerRentalDetailViewProps) {
  const { rental, approvedAt, payments, contract, documents } = detail
  const financialContext = { payments, contract }
  const nextAction = getCustomerRentalNextAction(rental, financialContext)
  const timelineStages = getCustomerRentalTimelineStages({
    rental,
    approvedAt,
    context: financialContext,
  })
  const statusClasses = getVenueRentalCalendarColorClasses(rental.calendarColor)

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
          <Link href="/customer/rentals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Venue Rentals
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">
            {rental.eventTypeName || "Venue rental"} · {rental.shortId}
          </h1>
          <p className="text-sm text-muted-foreground">
            Submitted {rental.submittedAtLabel}
          </p>
        </div>
        <Badge variant="secondary" className={cn(statusClasses.bg, statusClasses.text)}>
          {getCustomerFriendlyStatusLabel(rental.status)}
        </Badge>
      </div>

      <CustomerRentalNextActionPanel nextAction={nextAction} contract={contract} />

      <CustomerRentalTimeline stages={timelineStages} />

      <CustomerRentalPaymentsSection payments={payments} />

      <CustomerRentalRentalDetailsSection rental={rental} />

      <CustomerRentalContractSection contract={contract} />

      <CustomerRentalDocumentsSection documents={documents} contract={contract} />

      <CustomerRentalMessagesPlaceholder />
    </div>
  )
}

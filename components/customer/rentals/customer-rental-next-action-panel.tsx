import { FileSignature } from "lucide-react"

import { CustomerRentalProcessGuidanceCallout } from "@/components/customer/rentals/customer-rental-process-guidance-callout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CustomerRentalContractDto } from "@/lib/bookings/customer-venue-rental-dtos"
import { isCustomerPaymentActionType } from "@/lib/bookings/customer-rental-process-guidance"
import type { CustomerRentalNextAction } from "@/lib/bookings/customer-venue-rental-experience"
import { cn } from "@/lib/utils"

type CustomerRentalNextActionPanelProps = {
  nextAction: CustomerRentalNextAction
  contract: CustomerRentalContractDto | null
}

export function CustomerRentalNextActionPanel({
  nextAction,
  contract,
}: CustomerRentalNextActionPanelProps) {
  const showContractGuidance =
    nextAction.actionType === "sign_agreement" && contract?.canSign
  const showPaymentGuidance = isCustomerPaymentActionType(nextAction.actionType)

  return (
    <Card
      className={cn(
        nextAction.requiresAction && "border-amber-200 bg-amber-50/40"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          Next action
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{nextAction.label}</p>

        {showContractGuidance ? (
          <div className="space-y-3">
            {contract?.canDownload && contract.documentUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={contract.documentUrl} target="_blank" rel="noopener noreferrer">
                  <FileSignature className="mr-2 h-4 w-4" />
                  Download agreement
                </a>
              </Button>
            ) : null}
            <CustomerRentalProcessGuidanceCallout variant="contract" />
          </div>
        ) : null}

        {showPaymentGuidance ? (
          <CustomerRentalProcessGuidanceCallout
            variant="payment"
            actionType={nextAction.actionType}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

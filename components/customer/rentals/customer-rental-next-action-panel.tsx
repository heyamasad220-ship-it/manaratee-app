import { AlertCircle, FileSignature } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CustomerRentalContractDto } from "@/lib/bookings/customer-venue-rental-dtos"
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
  const showSignPlaceholder =
    nextAction.actionType === "sign_agreement" && contract?.canSign
  const showPayPlaceholder =
    nextAction.actionType === "pay_deposit" ||
    nextAction.actionType === "pay_security_deposit" ||
    nextAction.actionType === "pay_remaining_balance"

  return (
    <Card
      className={cn(
        nextAction.requiresAction && "border-amber-200 bg-amber-50/40"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {nextAction.requiresAction ? (
            <AlertCircle className="h-4 w-4 text-amber-700" />
          ) : null}
          Next action
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{nextAction.label}</p>

        {showSignPlaceholder ? (
          <div className="flex flex-wrap gap-2">
            {contract?.canDownload && contract.documentUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={contract.documentUrl} target="_blank" rel="noopener noreferrer">
                  <FileSignature className="mr-2 h-4 w-4" />
                  Download agreement
                </a>
              </Button>
            ) : null}
            <Button size="sm" disabled title="Contract signing will be available in a future release">
              <FileSignature className="mr-2 h-4 w-4" />
              Sign agreement
            </Button>
          </div>
        ) : null}

        {showPayPlaceholder ? (
          <Button size="sm" disabled title="Online payment will be available in a future release">
            {nextAction.actionType === "pay_deposit"
              ? "Pay deposit"
              : nextAction.actionType === "pay_security_deposit"
                ? "Pay security deposit"
                : "Pay remaining balance"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

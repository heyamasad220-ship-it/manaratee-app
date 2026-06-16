import { Info, Mail } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  getCustomerContractProcessGuidance,
  getCustomerPaymentProcessGuidance,
  isCustomerPaymentActionType,
} from "@/lib/bookings/customer-rental-process-guidance"
import { cn } from "@/lib/utils"

type CustomerRentalProcessGuidanceCalloutProps = {
  variant: "payment" | "contract"
  actionType?: CustomerRentalPaymentActionType | string
  dueDateLabel?: string | null
  className?: string
}

export function CustomerRentalProcessGuidanceCallout({
  variant,
  actionType,
  dueDateLabel,
  className,
}: CustomerRentalProcessGuidanceCalloutProps) {
  const paymentActionType = isCustomerPaymentActionType(actionType)
    ? actionType
    : undefined

  const guidance =
    variant === "contract"
      ? getCustomerContractProcessGuidance()
      : getCustomerPaymentProcessGuidance(paymentActionType, { dueDateLabel })

  const Icon = variant === "payment" ? Mail : Info

  return (
    <Alert
      className={cn("border-amber-200 bg-amber-50/70 text-amber-950", className)}
    >
      <Icon className="text-amber-800" />
      <AlertTitle className="text-amber-950">{guidance.title}</AlertTitle>
      <AlertDescription className="text-amber-900/90">{guidance.description}</AlertDescription>
    </Alert>
  )
}

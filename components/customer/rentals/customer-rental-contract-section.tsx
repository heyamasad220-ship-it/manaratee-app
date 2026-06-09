import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CustomerRentalContractDto } from "@/lib/bookings/customer-venue-rental-dtos"

type CustomerRentalContractSectionProps = {
  contract: CustomerRentalContractDto | null
}

export function CustomerRentalContractSection({
  contract,
}: CustomerRentalContractSectionProps) {
  const status = contract?.status ?? "Not Available"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contract</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Contract status</span>
          <span className="font-medium">{status}</span>
        </div>
        {contract?.canDownload && contract.documentUrl ? (
          <p className="text-muted-foreground">
            Your rental agreement is available in the Documents section below.
          </p>
        ) : contract?.canSign ? (
          <p className="text-muted-foreground">
            Your agreement is ready to review. Signing will be available in a future release.
          </p>
        ) : (
          <p className="text-muted-foreground">
            A contract will appear here after your request is approved.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

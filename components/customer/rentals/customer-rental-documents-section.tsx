import { Download, FileText, FileSignature } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  CustomerRentalContractDto,
  CustomerRentalDocumentDto,
} from "@/lib/bookings/customer-venue-rental-dtos"

type CustomerRentalDocumentsSectionProps = {
  documents: CustomerRentalDocumentDto[]
  contract: CustomerRentalContractDto | null
}

function statusBadgeClass(status: CustomerRentalDocumentDto["status"]): string {
  switch (status) {
    case "Signed":
      return "bg-emerald-50 text-emerald-800"
    case "Available":
      return "bg-blue-50 text-blue-800"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function DocumentIcon({ type }: { type: CustomerRentalDocumentDto["type"] }) {
  if (type === "rental_agreement") return <FileSignature className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

export function CustomerRentalDocumentsSection({
  documents,
  contract,
}: CustomerRentalDocumentsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.map((document) => (
          <div
            key={document.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <DocumentIcon type={document.type} />
              <div>
                <p className="text-sm font-medium">{document.label}</p>
                {document.description ? (
                  <p className="text-xs text-muted-foreground">{document.description}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={statusBadgeClass(document.status)}>
                {document.status}
              </Badge>
              {document.downloadUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={document.downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              ) : null}
              {document.type === "rental_agreement" && contract?.canSign ? (
                <Button size="sm" disabled title="Signing will be available in a future release">
                  Sign contract
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

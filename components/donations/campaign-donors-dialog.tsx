"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CampaignDonorSummary } from "@/lib/donations/campaign-analytics"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

type CampaignDonorsDialogProps = {
  campaignName: string
  donors: CampaignDonorSummary[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDonorClick?: (donor: CampaignDonorSummary) => void
}

export function CampaignDonorsDialog({
  campaignName,
  donors,
  open,
  onOpenChange,
  onDonorClick,
}: CampaignDonorsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Campaign Donors</DialogTitle>
          <DialogDescription>
            Donors linked to payments or pledges for {campaignName}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead className="text-right">Total Given</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                    No donors yet
                  </TableCell>
                </TableRow>
              ) : (
                donors.map((donor, index) => (
                  <TableRow key={donor.donorId || `${donor.displayName}-${index}`}>
                    <TableCell className="font-medium">
                      {onDonorClick && (donor.contactId || donor.donorId) ? (
                        <button
                          type="button"
                          onClick={() => onDonorClick(donor)}
                          className="text-primary hover:underline"
                        >
                          {donor.displayName}
                        </button>
                      ) : (
                        donor.displayName
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDonationCurrency(donor.totalGiven)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

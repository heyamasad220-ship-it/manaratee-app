"use client"

import { useState } from "react"
import { MoreHorizontal, Plus, Tag } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DiscountCode } from "@/lib/mock-data"
import type { TicketingDiscountCode } from "@/lib/tickets/ticketing-checkout-ui-types"

function StatusBadge({ status }: { status: DiscountCode["status"] }) {
  const colors: Record<DiscountCode["status"], string> = {
    Active: "bg-emerald-100 text-emerald-800",
    Expired: "bg-gray-100 text-gray-800",
    Inactive: "bg-red-100 text-red-800",
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {status}
    </span>
  )
}

type DiscountCodesPanelProps = {
  title: string
  description: string
  codes: TicketingDiscountCode[]
  scope: "organization" | "event"
  eventName?: string
}

export function DiscountCodesPanel({
  title,
  description,
  codes,
  scope,
  eventName,
}: DiscountCodesPanelProps) {
  const [showCreateDiscount, setShowCreateDiscount] = useState(false)
  const [monthFilter, setMonthFilter] = useState("all")

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{title}</h4>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {scope === "organization" ? "All events" : "This event only"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button onClick={() => setShowCreateDiscount(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {scope === "organization" ? "Create promo code" : "Create event promo"}
          </Button>
        </div>

        {scope === "organization" ? (
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              <SelectItem value="march-2026">March 2026</SelectItem>
              <SelectItem value="april-2026">April 2026</SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code & label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                {scope === "organization" ? <TableHead>Valid period</TableHead> : null}
                <TableHead>Status</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={scope === "organization" ? 7 : 6}
                    className="h-20 text-center text-muted-foreground"
                  >
                    {scope === "event"
                      ? "No promo codes for this event yet."
                      : "No organization promo codes yet."}
                  </TableCell>
                </TableRow>
              ) : (
                codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-primary">{code.code}</span>
                        {code.label ? (
                          <span className="text-xs text-muted-foreground">{code.label}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {code.type === "Percentage" ? "%" : "$"} {code.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {code.type === "Percentage" ? `${code.discount}%` : `$${code.discount}`}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {code.usageCount} / {code.usageLimit || "∞"}
                      </span>
                    </TableCell>
                    {scope === "organization" ? (
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>{code.activeFrom}</span>
                          <span>to {code.activeTo}</span>
                        </div>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <StatusBadge status={code.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showCreateDiscount} onOpenChange={setShowCreateDiscount}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {scope === "organization"
                ? "Create organization promo code"
                : "Create event promo code"}
            </DialogTitle>
            <DialogDescription>
              {scope === "organization"
                ? "Valid at checkout for any ticketed event."
                : `Only valid for ${eventName || "this event"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="discount-code">Code</Label>
              <Input id="discount-code" placeholder="SPRING50" className="uppercase" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="discount-label">
                Label <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="discount-label" placeholder="Spring special" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label htmlFor="discount-value">Discount value</Label>
                <Input id="discount-value" type="number" placeholder="10" />
              </div>
              <div className="w-32">
                <Label htmlFor="discount-type">Type</Label>
                <Select defaultValue="percentage">
                  <SelectTrigger id="discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Valid period</Label>
              <div className="flex items-center gap-2">
                <Input type="date" className="flex-1" />
                <span className="text-muted-foreground">to</span>
                <Input type="date" className="flex-1" />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="single-use" className="text-sm">
                  One per customer
                </Label>
                <p className="text-xs text-muted-foreground">
                  Each customer can only use this code once
                </p>
              </div>
              <Switch id="single-use" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDiscount(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowCreateDiscount(false)}>Create promo code</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

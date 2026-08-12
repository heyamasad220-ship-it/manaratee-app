"use client"

import { useState } from "react"
import { Store } from "lucide-react"

import { BoothTypesSettingsPanel } from "@/components/vendor-hub/booth-types-settings-panel"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export function BazaarEventSettingsClient({ eventId }: { eventId: string }) {
  const [requireDeposit, setRequireDeposit] = useState(false)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-5 w-5" />
            Booth Settings
          </CardTitle>
          <CardDescription>
            Event-specific booth pricing, deposits, and limits. Leave blank fields to follow
            organization defaults from Vendor Hub → Settings → Booths.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-booth-base-price">Base Booth Price</Label>
              <Input
                id="event-booth-base-price"
                type="number"
                placeholder="Enter base price"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="event-booth-deposit">Deposit Amount</Label>
              <Input
                id="event-booth-deposit"
                type="number"
                placeholder="Enter deposit amount"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Require Deposit</p>
              <p className="text-sm text-muted-foreground">
                Vendors must pay a deposit to secure their booth.
              </p>
            </div>
            <Switch checked={requireDeposit} onCheckedChange={setRequireDeposit} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-max-booths">Maximum Booths Per Vendor</Label>
            <Select>
              <SelectTrigger id="event-max-booths">
                <SelectValue placeholder="Select booth limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 booth</SelectItem>
                <SelectItem value="2">2 booths</SelectItem>
                <SelectItem value="3">3 booths</SelectItem>
                <SelectItem value="unlimited">Unlimited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <BoothTypesSettingsPanel
        mode="event"
        eventId={eventId}
        showAttributes={false}
        allowCopyFromDefaults
      />
    </div>
  )
}

"use client"

import Link from "next/link"
import { Baby, Heart, Plus, Store, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type EventServiceRequirementsFormState,
} from "@/lib/events/event-service-requirements"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

type EventServiceRequirementsFieldsProps = {
  value: EventServiceRequirementsFormState
  onChange: (next: EventServiceRequirementsFormState) => void
  vendorTypes?: VendorHubVendorType[]
  canManageVendorTypes?: boolean
}

export function EventServiceRequirementsFields({
  value,
  onChange,
  vendorTypes = [],
  canManageVendorTypes = false,
}: EventServiceRequirementsFieldsProps) {
  function update(partial: Partial<EventServiceRequirementsFormState>) {
    onChange({ ...value, ...partial })
  }

  function addVolunteerRole() {
    update({
      volunteerRoles: [
        ...value.volunteerRoles,
        { id: `role-${Date.now()}`, name: "", slots: "1" },
      ],
    })
  }

  function updateVolunteerRole(
    id: string,
    field: "name" | "slots",
    fieldValue: string
  ) {
    update({
      volunteerRoles: value.volunteerRoles.map((role) =>
        role.id === id ? { ...role, [field]: fieldValue } : role
      ),
    })
  }

  function removeVolunteerRole(id: string) {
    update({
      volunteerRoles: value.volunteerRoles.filter((role) => role.id !== id),
    })
  }

  function addChildcareAgeGroup() {
    update({
      childcareAgeGroups: [
        ...value.childcareAgeGroups,
        { id: `age-group-${Date.now()}`, ageRange: "", capacity: "" },
      ],
    })
  }

  function updateChildcareAgeGroup(
    id: string,
    field: "ageRange" | "capacity",
    fieldValue: string
  ) {
    update({
      childcareAgeGroups: value.childcareAgeGroups.map((group) =>
        group.id === id ? { ...group, [field]: fieldValue } : group
      ),
    })
  }

  function removeChildcareAgeGroup(id: string) {
    update({
      childcareAgeGroups: value.childcareAgeGroups.filter((group) => group.id !== id),
    })
  }

  function addVendorSlot() {
    update({
      vendorSlots: [
        ...value.vendorSlots,
        {
          id: `vendor-slot-${Date.now()}`,
          vendorTypeId: "",
          vendorTypeName: "",
          quantity: "1",
          fee: "",
        },
      ],
    })
  }

  function updateVendorSlot(
    id: string,
    field: "vendorTypeId" | "quantity" | "fee",
    fieldValue: string
  ) {
    update({
      vendorSlots: value.vendorSlots.map((slot) => {
        if (slot.id !== id) return slot

        if (field === "vendorTypeId") {
          const vendorType = vendorTypes.find((type) => type.id === fieldValue)
          const defaultFee =
            vendorType?.default_fee != null ? String(vendorType.default_fee) : ""
          return {
            ...slot,
            vendorTypeId: fieldValue,
            vendorTypeName: vendorType?.name || "",
            fee: slot.fee || defaultFee,
          }
        }

        return { ...slot, [field]: fieldValue }
      }),
    })
  }

  function removeVendorSlot(id: string) {
    update({
      vendorSlots: value.vendorSlots.filter((slot) => slot.id !== id),
    })
  }

  const activeVendorTypes = vendorTypes.filter((type) => type.is_active)

  function renderVolunteerSettings() {
    return (
      <div className="space-y-3 border-t px-3 pb-3 pt-3">
        <div className="space-y-2">
          {value.volunteerRoles.map((role) => (
            <div key={role.id} className="flex items-center gap-2">
              <Input
                placeholder="Role name"
                value={role.name}
                onChange={(event) =>
                  updateVolunteerRole(role.id, "name", event.target.value)
                }
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                placeholder="Slots"
                value={role.slots}
                onChange={(event) =>
                  updateVolunteerRole(role.id, "slots", event.target.value)
                }
                className="w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeVolunteerRole(role.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addVolunteerRole}
            className="w-fit"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add role
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-volunteers">Max volunteers</Label>
          <Input
            id="max-volunteers"
            type="number"
            min={1}
            placeholder="Total volunteer limit"
            value={value.maxVolunteers}
            onChange={(event) => update({ maxVolunteers: event.target.value })}
          />
        </div>
      </div>
    )
  }

  function renderChildcareSettings() {
    return (
      <div className="space-y-3 border-t px-3 pb-3 pt-3">
        <div className="space-y-2">
          <Label>Age ranges and capacity</Label>
          <p className="text-xs text-muted-foreground">
            Enter each age group and capacity, for example 1-5 or 6-9 years.
          </p>
          {value.childcareAgeGroups.map((group) => (
            <div key={group.id} className="flex items-center gap-2">
              <Input
                placeholder="e.g. 1-5 years"
                value={group.ageRange}
                onChange={(event) =>
                  updateChildcareAgeGroup(group.id, "ageRange", event.target.value)
                }
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                placeholder="Capacity"
                value={group.capacity}
                onChange={(event) =>
                  updateChildcareAgeGroup(group.id, "capacity", event.target.value)
                }
                className="w-28"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeChildcareAgeGroup(group.id)}
                disabled={value.childcareAgeGroups.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addChildcareAgeGroup}
            className="w-fit"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add age range
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="childcare-deadline">Registration deadline</Label>
          <Input
            id="childcare-deadline"
            type="date"
            value={value.childcareDeadline}
            onChange={(event) => update({ childcareDeadline: event.target.value })}
          />
        </div>
      </div>
    )
  }

  function renderVendorSettings() {
    return (
      <div className="space-y-3 border-t px-3 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label>Vendor types needed</Label>
            <p className="text-xs text-muted-foreground">
              Specify how many of each vendor type you need and the fee for each.
            </p>
          </div>
          {canManageVendorTypes ? (
            <Link
              href="/vendor-hub/settings"
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Manage types
            </Link>
          ) : null}
        </div>

        {activeVendorTypes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {canManageVendorTypes
              ? "Add vendor types in Vendor Hub settings first."
              : "Ask an administrator to configure vendor types in Vendor Hub settings."}
          </p>
        ) : null}

        <div className="space-y-2">
          {value.vendorSlots.map((slot) => (
            <div key={slot.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_104px_40px]">
              <Select
                value={slot.vendorTypeId || undefined}
                onValueChange={(next) => updateVendorSlot(slot.id, "vendorTypeId", next)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vendor type" />
                </SelectTrigger>
                <SelectContent>
                  {activeVendorTypes.map((vendorType) => (
                    <SelectItem key={vendorType.id} value={vendorType.id}>
                      {vendorType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                placeholder="Qty"
                value={slot.quantity}
                onChange={(event) =>
                  updateVendorSlot(slot.id, "quantity", event.target.value)
                }
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Fee ($)"
                value={slot.fee}
                onChange={(event) => updateVendorSlot(slot.id, "fee", event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeVendorSlot(slot.id)}
                disabled={value.vendorSlots.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addVendorSlot}
            className="w-fit"
            disabled={activeVendorTypes.length === 0}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add vendor type
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vendor-deadline">Application deadline</Label>
          <Input
            id="vendor-deadline"
            type="date"
            value={value.vendorDeadline}
            onChange={(event) => update({ vendorDeadline: event.target.value })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor="vendor-approval" className="font-normal">
            Require approval for vendor applications
          </Label>
          <Switch
            id="vendor-approval"
            checked={value.vendorApprovalRequired}
            onCheckedChange={(checked) => update({ vendorApprovalRequired: checked })}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Service requirements</h3>
        <p className="text-xs text-muted-foreground">
          Turn on modules this event needs. Volunteers and childcare providers come from
          workforce contacts; vendors are events-only.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Volunteer sign-ups</p>
                <p className="text-xs text-muted-foreground">
                  Recruit volunteers from your workforce roster
                </p>
              </div>
            </div>
            <Switch
              checked={value.requiresVolunteers}
              onCheckedChange={(checked) => {
                if (checked && value.volunteerRoles.length === 0) {
                  update({
                    requiresVolunteers: true,
                    volunteerRoles: [
                      { id: `role-${Date.now()}`, name: "", slots: "1" },
                    ],
                  })
                  return
                }

                update({ requiresVolunteers: checked })
              }}
            />
          </div>
          {value.requiresVolunteers ? renderVolunteerSettings() : null}
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Baby className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Childcare</p>
                <p className="text-xs text-muted-foreground">
                  Offer childcare from approved providers
                </p>
              </div>
            </div>
            <Switch
              checked={value.requiresChildcare}
              onCheckedChange={(checked) => {
                if (checked && value.childcareAgeGroups.length === 0) {
                  update({
                    requiresChildcare: true,
                    childcareAgeGroups: [
                      { id: `age-group-${Date.now()}`, ageRange: "", capacity: "" },
                    ],
                  })
                  return
                }

                update({ requiresChildcare: checked })
              }}
            />
          </div>
          {value.requiresChildcare ? renderChildcareSettings() : null}
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Vendors</p>
                <p className="text-xs text-muted-foreground">
                  Allow vendor participation at this event
                </p>
              </div>
            </div>
            <Switch
              checked={value.requiresVendors}
              onCheckedChange={(checked) => {
                if (checked && value.vendorSlots.length === 0) {
                  update({
                    requiresVendors: true,
                    vendorSlots: [
                      {
                        id: `vendor-slot-${Date.now()}`,
                        vendorTypeId: "",
                        vendorTypeName: "",
                        quantity: "1",
                        fee: "",
                      },
                    ],
                  })
                  return
                }

                update({ requiresVendors: checked })
              }}
            />
          </div>
          {value.requiresVendors ? renderVendorSettings() : null}
        </div>
      </div>
    </div>
  )
}

"use client"

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
  CHILDCARE_AGE_RANGE_OPTIONS,
  type EventServiceRequirementsFormState,
} from "@/lib/events/event-service-requirements"

type EventServiceRequirementsFieldsProps = {
  value: EventServiceRequirementsFormState
  onChange: (next: EventServiceRequirementsFormState) => void
}

export function EventServiceRequirementsFields({
  value,
  onChange,
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

  const anyEnabled =
    value.requiresVolunteers || value.requiresChildcare || value.requiresVendors

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
        <div className="flex items-center justify-between rounded-lg border p-3">
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
            onCheckedChange={(checked) => update({ requiresVolunteers: checked })}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
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
              if (
                checked &&
                value.childcareAgeGroups.length === 0
              ) {
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

        <div className="flex items-center justify-between rounded-lg border p-3">
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
            onCheckedChange={(checked) => update({ requiresVendors: checked })}
          />
        </div>
      </div>

      {anyEnabled ? (
        <div className="space-y-4 border-t pt-4">
          {value.requiresVolunteers ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Volunteer settings</p>
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
          ) : null}

          {value.requiresChildcare ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Childcare settings</p>
              <div className="space-y-2">
                <Label>Age ranges and capacity</Label>
                <p className="text-xs text-muted-foreground">
                  Add one row per age group with its own capacity limit.
                </p>
                {value.childcareAgeGroups.map((group) => (
                  <div key={group.id} className="flex items-center gap-2">
                    <Select
                      value={group.ageRange || undefined}
                      onValueChange={(next) =>
                        updateChildcareAgeGroup(group.id, "ageRange", next)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select age range" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHILDCARE_AGE_RANGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  onChange={(event) =>
                    update({ childcareDeadline: event.target.value })
                  }
                />
              </div>
            </div>
          ) : null}

          {value.requiresVendors ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Vendor settings</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="max-vendors">Max vendors</Label>
                  <Input
                    id="max-vendors"
                    type="number"
                    min={1}
                    placeholder="10"
                    value={value.maxVendors}
                    onChange={(event) => update({ maxVendors: event.target.value })}
                  />
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-fee">Vendor fee</Label>
                <Input
                  id="vendor-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={value.vendorFee}
                  onChange={(event) => update({ vendorFee: event.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="vendor-approval" className="font-normal">
                  Require approval for vendor applications
                </Label>
                <Switch
                  id="vendor-approval"
                  checked={value.vendorApprovalRequired}
                  onCheckedChange={(checked) =>
                    update({ vendorApprovalRequired: checked })
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

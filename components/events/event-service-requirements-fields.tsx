"use client"

import Link from "next/link"
import { Fragment, type KeyboardEvent } from "react"
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
  createEmptyVolunteerRole,
  createEmptyVolunteerShift,
  createEmptyYouthGroup,
  formatAgeRangeFromBounds,
  YOUTH_GENDER_OPTIONS,
  YOUTH_OFFERING_OPTIONS,
  type EventServiceRequirementsFormState,
  type EventYouthGender,
  type EventYouthOffering,
  type YouthGroupFormRow,
} from "@/lib/events/event-service-requirements"
import {
  addHoursToTime,
  createEmptyVolunteerWindow,
  createEmptyVolunteerWindowSlot,
  formatVolunteerHourOption,
  volunteerHourOptions,
  type VolunteerWindowFormRow,
} from "@/lib/events/volunteer-windows"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

type EventServiceRequirementsFieldsProps = {
  value: EventServiceRequirementsFormState
  onChange: (next: EventServiceRequirementsFormState) => void
  vendorTypes?: VendorHubVendorType[]
  canManageVendorTypes?: boolean
  /** Limit which service modules are shown (default: all). */
  visibleModules?: Array<"volunteers" | "childcare" | "vendors">
  hideHeader?: boolean
  /** Hide Enable switches and always show settings (parent owns enable/save). */
  hideEnableSwitch?: boolean
  /**
   * Staff tab: always show the time-and-slot sheet. Volunteer enable is optional
   * and does not hide the sheet.
   */
  staffMode?: boolean
  /**
   * Event service needs: turn volunteers on here. Times and slots are edited on
   * the Sign-ups tab so this save does not replace that sheet.
   */
  hideVolunteerDetails?: boolean
  /** Bazaar Sign-ups → Slots: time windows only, with no enable switch or card. */
  slotsOnly?: boolean
}

function childcareAgeGroupsFromYouth(groups: YouthGroupFormRow[]) {
  return groups.map((group) => ({
    id: group.id,
    ageRange: formatAgeRangeFromBounds(group.ageMin, group.ageMax),
    capacity: group.capacity,
  }))
}

function VolunteerHourSelect({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
}) {
  const options = volunteerHourOptions(value)
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger className="w-[120px]" aria-label={label}>
          <SelectValue placeholder="Select time" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {formatVolunteerHourOption(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function EventServiceRequirementsFields({
  value,
  onChange,
  vendorTypes = [],
  canManageVendorTypes = false,
  visibleModules,
  hideHeader = false,
  hideEnableSwitch = false,
  staffMode = false,
  hideVolunteerDetails = false,
  slotsOnly = false,
}: EventServiceRequirementsFieldsProps) {
  const showVolunteers = !visibleModules || visibleModules.includes("volunteers")
  const showChildcare = !visibleModules || visibleModules.includes("childcare")
  const showVendors = !visibleModules || visibleModules.includes("vendors")

  function update(partial: Partial<EventServiceRequirementsFormState>) {
    onChange({ ...value, ...partial })
  }

  function setYouthGroups(youthGroups: YouthGroupFormRow[]) {
    update({
      youthGroups,
      childcareAgeGroups: childcareAgeGroupsFromYouth(youthGroups),
    })
  }

  function commitWindows(next: VolunteerWindowFormRow[]) {
    update({ volunteerWindows: next, volunteerWindowsExplicit: true })
  }

  function currentWindows() {
    const windows = value.volunteerWindows || []
    if (windows.length > 0) return windows
    if (staffMode || slotsOnly) {
      return [createEmptyVolunteerWindow({ id: "win-default" })]
    }
    return windows
  }

  function updateVolunteerWindow(
    id: string,
    patch: Partial<Pick<VolunteerWindowFormRow, "start" | "end">>
  ) {
    commitWindows(
      currentWindows().map((window) =>
        window.id === id ? { ...window, ...patch } : window
      )
    )
  }

  function addWindowSlot(windowId: string) {
    commitWindows(
      currentWindows().map((window) =>
        window.id === windowId
          ? {
              ...window,
              slots: [...window.slots, createEmptyVolunteerWindowSlot()],
            }
          : window
      )
    )
  }

  function updateWindowSlot(
    windowId: string,
    slotId: string,
    patch: Partial<{ name: string; openings: string }>
  ) {
    commitWindows(
      currentWindows().map((window) => {
        if (window.id !== windowId) return window
        return {
          ...window,
          slots: window.slots.map((slot) =>
            slot.id === slotId ? { ...slot, ...patch } : slot
          ),
        }
      })
    )
  }

  function removeWindowSlot(windowId: string, slotId: string) {
    commitWindows(
      currentWindows().map((window) => {
        if (window.id !== windowId) return window
        const slots = window.slots.filter((slot) => slot.id !== slotId)
        return {
          ...window,
          slots: slots.length > 0 ? slots : [createEmptyVolunteerWindowSlot()],
        }
      })
    )
  }

  function addVolunteerRole() {
    update({
      volunteerRoles: [...value.volunteerRoles, createEmptyVolunteerRole()],
    })
  }

  function updateVolunteerRole(
    id: string,
    patch: Partial<(typeof value.volunteerRoles)[number]>
  ) {
    update({
      volunteerRoles: value.volunteerRoles.map((role) =>
        role.id === id ? { ...role, ...patch } : role
      ),
    })
  }

  function removeVolunteerRole(id: string) {
    update({
      volunteerRoles: value.volunteerRoles.filter((role) => role.id !== id),
    })
  }

  function addShift(roleId: string) {
    update({
      volunteerRoles: value.volunteerRoles.map((role) =>
        role.id === roleId
          ? { ...role, shifts: [...role.shifts, createEmptyVolunteerShift()] }
          : role
      ),
    })
  }

  function updateShift(
    roleId: string,
    shiftId: string,
    patch: Partial<(typeof value.volunteerRoles)[number]["shifts"][number]>
  ) {
    update({
      volunteerRoles: value.volunteerRoles.map((role) => {
        if (role.id !== roleId) return role
        return {
          ...role,
          shifts: role.shifts.map((shift) =>
            shift.id === shiftId ? { ...shift, ...patch } : shift
          ),
        }
      }),
    })
  }

  function removeShift(roleId: string, shiftId: string) {
    update({
      volunteerRoles: value.volunteerRoles.map((role) =>
        role.id === roleId
          ? {
              ...role,
              shifts: role.shifts.filter((shift) => shift.id !== shiftId),
            }
          : role
      ),
    })
  }

  function updateYouthGroup(
    id: string,
    patch: Partial<YouthGroupFormRow>
  ) {
    setYouthGroups(
      value.youthGroups.map((group) =>
        group.id === id ? { ...group, ...patch } : group
      )
    )
  }

  function removeYouthGroup(id: string) {
    setYouthGroups(value.youthGroups.filter((group) => group.id !== id))
  }

  function setSharedYouthDeadline(deadline: string) {
    const youthGroups = value.youthGroups.map((group) => ({
      ...group,
      registrationDeadline: deadline,
    }))
    update({
      childcareDeadline: deadline,
      youthGroups,
      childcareAgeGroups: childcareAgeGroupsFromYouth(youthGroups),
    })
  }

  function setSharedYouthQuestions(checked: boolean) {
    setYouthGroups(
      value.youthGroups.map((group) => ({
        ...group,
        includeYouthQuestions: checked,
      }))
    )
  }

  function handleCapacityCommit(
    groupId: string,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key !== "Enter" && event.key !== "Tab") return
    if (event.key === "Tab" && event.shiftKey) return

    const index = value.youthGroups.findIndex((group) => group.id === groupId)
    if (index < 0 || index !== value.youthGroups.length - 1) return

    const group = value.youthGroups[index]
    if (!group.capacity.trim()) return

    event.preventDefault()
    const next = createEmptyYouthGroup({
      registrationDeadline: value.childcareDeadline,
      includeYouthQuestions: group.includeYouthQuestions !== false,
    })
    setYouthGroups([...value.youthGroups, next])

    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-youth-offering="${next.id}"]`
      )
      el?.focus()
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
    if (staffMode || slotsOnly) {
      const windows = currentWindows()
      return (
        <div className={slotsOnly ? "space-y-4" : "space-y-4 border-t px-3 pb-3 pt-3"}>
          <div>
            <Label>Times and slots</Label>
            <p className="text-xs text-muted-foreground">
              Set the time, then name each job and how many people it needs.
              Date and location stay on the event.
            </p>
          </div>
          {windows.map((window) => (
            <div
              key={window.id}
              className="grid grid-cols-[120px_120px_minmax(12rem,1fr)_6.5rem_auto] items-end gap-x-2 gap-y-2"
            >
              {window.slots.map((slot, index) => (
                <Fragment key={slot.id}>
                  {index === 0 ? (
                    <>
                      <VolunteerHourSelect
                        label="Start"
                        value={window.start}
                        onValueChange={(start) => {
                          const end =
                            window.end.trim() ||
                            (start ? addHoursToTime(start, 2) : "")
                          updateVolunteerWindow(window.id, { start, end })
                        }}
                      />
                      <VolunteerHourSelect
                        label="End"
                        value={window.end}
                        onValueChange={(end) =>
                          updateVolunteerWindow(window.id, { end })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <div aria-hidden />
                      <div aria-hidden />
                    </>
                  )}
                  <div className="min-w-[12rem] flex-1 space-y-1">
                    {index === 0 ? <Label className="text-xs">Slot</Label> : null}
                    <Input
                      placeholder="Registration"
                      value={slot.name}
                      onChange={(event) =>
                        updateWindowSlot(window.id, slot.id, {
                          name: event.target.value,
                        })
                      }
                      aria-label="Slot"
                    />
                  </div>
                  <div className="space-y-1">
                    {index === 0 ? (
                      <Label className="text-xs">Open slots</Label>
                    ) : null}
                    <Input
                      type="number"
                      min={1}
                      value={slot.openings}
                      onChange={(event) =>
                        updateWindowSlot(window.id, slot.id, {
                          openings: event.target.value,
                        })
                      }
                      className="w-[6.5rem]"
                      aria-label="Open slots"
                    />
                  </div>
                  {index === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addWindowSlot(window.id)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add slot
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeWindowSlot(window.id, slot.id)}
                      aria-label="Remove slot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      )
    }

    if (hideVolunteerDetails) {
      if (!value.requiresVolunteers) return null
      return (
        <p className="border-t px-3 py-3 text-xs text-muted-foreground">
          Set times and volunteer slots on the Sign-ups tab.
        </p>
      )
    }

    return (
      <div className="space-y-3 border-t px-3 pb-3 pt-3">
        <div className="space-y-3">
          <div>
            <Label>{staffMode ? "Tasks & shifts" : "Roles"}</Label>
            <p className="text-xs text-muted-foreground">
              {staffMode
                ? "Define tasks, required headcount, and optional shifts. Assign people on this tab below."
                : "Volunteer roles and capacity for this event."}
            </p>
          </div>
          {value.volunteerRoles.map((role) => (
            <div
              key={role.id}
              className="space-y-2 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder={staffMode ? "Task name" : "Role name"}
                  value={role.name}
                  onChange={(event) =>
                    updateVolunteerRole(role.id, { name: event.target.value })
                  }
                  className="min-w-[160px] flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Needed"
                  value={role.slots}
                  onChange={(event) =>
                    updateVolunteerRole(role.id, { slots: event.target.value })
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
              {staffMode ? (
                <>
                  <Input
                    placeholder="Description / instructions (optional)"
                    value={role.description}
                    onChange={(event) =>
                      updateVolunteerRole(role.id, {
                        description: event.target.value,
                      })
                    }
                  />
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={role.staffAllowed}
                        onCheckedChange={(checked) =>
                          updateVolunteerRole(role.id, {
                            staffAllowed: checked,
                          })
                        }
                      />
                      Staff allowed
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={role.volunteerAllowed}
                        onCheckedChange={(checked) =>
                          updateVolunteerRole(role.id, {
                            volunteerAllowed: checked,
                          })
                        }
                      />
                      Volunteers allowed
                    </label>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Shifts
                    </p>
                    {role.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <div className="space-y-1">
                          <Label className="text-xs">Start</Label>
                          <Input
                            type="time"
                            value={shift.start}
                            onChange={(event) =>
                              updateShift(role.id, shift.id, {
                                start: event.target.value,
                              })
                            }
                            className="w-[130px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End</Label>
                          <Input
                            type="time"
                            value={shift.end}
                            onChange={(event) =>
                              updateShift(role.id, shift.id, {
                                end: event.target.value,
                              })
                            }
                            className="w-[130px]"
                          />
                        </div>
                        <div className="min-w-[140px] flex-1 space-y-1">
                          <Label className="text-xs">Location</Label>
                          <Input
                            placeholder="Optional"
                            value={shift.location}
                            onChange={(event) =>
                              updateShift(role.id, shift.id, {
                                location: event.target.value,
                              })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeShift(role.id, shift.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addShift(role.id)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add shift
                    </Button>
                  </div>
                </>
              ) : null}
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
            {staffMode ? "Add task" : "Add role"}
          </Button>
        </div>
        {staffMode || value.requiresVolunteers ? (
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
        ) : null}
      </div>
    )
  }

  function renderYouthSettings() {
    const sharedYouthQuestions =
      value.youthGroups.length === 0
        ? true
        : value.youthGroups.every((group) => group.includeYouthQuestions !== false)

    return (
      <div className="space-y-3 border-t px-3 pb-3 pt-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Registration deadline</Label>
            <Input
              type="date"
              value={value.childcareDeadline}
              onChange={(event) => setSharedYouthDeadline(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-md border px-3 py-2">
              <Label className="font-normal">Youth questions</Label>
              <Switch
                checked={sharedYouthQuestions}
                onCheckedChange={setSharedYouthQuestions}
              />
            </div>
          </div>
          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label className="font-normal">Require liability waiver</Label>
                <p className="text-xs text-muted-foreground">
                  Guardians must sign before check-in. Upload the waiver under
                  Settings → Event documents.
                </p>
              </div>
              <Switch
                checked={value.requireYouthWaiver}
                onCheckedChange={(checked) =>
                  update({ requireYouthWaiver: checked })
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Youth groups</Label>
          <p className="text-xs text-muted-foreground">
            Enter capacity and press Enter or Tab to add another offering. Choose
            Field trip in Offering to add venue name and address.
          </p>
          {value.youthGroups.map((group) => (
            <div key={group.id} className="space-y-3 rounded-md border p-3">
              <div className="flex items-end gap-2">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-5">
                  <div className="space-y-2">
                    <Label>Offering</Label>
                    <Select
                      value={group.offering}
                      onValueChange={(next) =>
                        updateYouthGroup(group.id, {
                          offering: next as EventYouthOffering,
                          ...(next === "childcare"
                            ? { venueName: "", venueAddress: "" }
                            : {}),
                        })
                      }
                    >
                      <SelectTrigger data-youth-offering={group.id}>
                        <SelectValue placeholder="Offering" />
                      </SelectTrigger>
                      <SelectContent>
                        {YOUTH_OFFERING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Min age</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={group.ageMin}
                      onChange={(event) =>
                        updateYouthGroup(group.id, { ageMin: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max age</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Max"
                      value={group.ageMax}
                      onChange={(event) =>
                        updateYouthGroup(group.id, { ageMax: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={group.gender}
                      onValueChange={(next) =>
                        updateYouthGroup(group.id, {
                          gender: next as EventYouthGender,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {YOUTH_GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Capacity"
                      value={group.capacity}
                      onChange={(event) =>
                        updateYouthGroup(group.id, { capacity: event.target.value })
                      }
                      onKeyDown={(event) => handleCapacityCommit(group.id, event)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeYouthGroup(group.id)}
                  disabled={value.youthGroups.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {group.offering === "field_trip" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Venue name</Label>
                    <Input
                      placeholder="Venue name"
                      value={group.venueName}
                      onChange={(event) =>
                        updateYouthGroup(group.id, {
                          venueName: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Venue address</Label>
                    <Input
                      placeholder="Venue address"
                      value={group.venueAddress}
                      onChange={(event) =>
                        updateYouthGroup(group.id, {
                          venueAddress: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
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

  if (slotsOnly) {
    return renderVolunteerSettings()
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {hideHeader ? null : (
        <div>
          <h3 className="text-sm font-semibold">Service requirements</h3>
          <p className="text-xs text-muted-foreground">
            Turn on modules this event needs. Volunteers and youth providers come from
            workforce contacts; vendors are events-only.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {showVolunteers ? (
        <div className="overflow-hidden rounded-lg border">
          {hideEnableSwitch && !staffMode ? null : (
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {staffMode ? "Volunteer sign-ups" : "Volunteers"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {staffMode
                    ? "Open this event for volunteer sign-ups"
                    : hideVolunteerDetails
                      ? "Times and slots are set on the Sign-ups tab"
                      : "Recruit volunteers from your workforce roster"}
                </p>
              </div>
            </div>
            <Switch
              checked={value.requiresVolunteers}
              onCheckedChange={(checked) => {
                if (checked && staffMode && (value.volunteerWindows || []).length === 0) {
                  update({
                    requiresVolunteers: true,
                    volunteerWindowsExplicit: true,
                    volunteerWindows: [createEmptyVolunteerWindow()],
                  })
                  return
                }
                if (
                  checked &&
                  !staffMode &&
                  !hideVolunteerDetails &&
                  value.volunteerRoles.length === 0
                ) {
                  update({
                    requiresVolunteers: true,
                    volunteerRoles: [createEmptyVolunteerRole()],
                  })
                  return
                }

                update({ requiresVolunteers: checked })
              }}
            />
          </div>
          )}
          {staffMode || hideEnableSwitch || value.requiresVolunteers
            ? renderVolunteerSettings()
            : null}
        </div>
        ) : null}

        {showChildcare ? (
        <div className="overflow-hidden rounded-lg border">
          {hideEnableSwitch ? null : (
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Baby className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Youth</p>
                <p className="text-xs text-muted-foreground">
                  Childcare and field trip offerings for this event
                </p>
              </div>
            </div>
            <Switch
              checked={value.requiresChildcare}
              onCheckedChange={(checked) => {
                if (checked && value.youthGroups.length === 0) {
                  const seeded = [createEmptyYouthGroup()]
                  update({
                    requiresChildcare: true,
                    youthGroups: seeded,
                    childcareAgeGroups: childcareAgeGroupsFromYouth(seeded),
                  })
                  return
                }

                update({ requiresChildcare: checked })
              }}
            />
          </div>
          )}
          {hideEnableSwitch || value.requiresChildcare ? renderYouthSettings() : null}
        </div>
        ) : null}

        {showVendors ? (
        <div className="overflow-hidden rounded-lg border">
          {hideEnableSwitch ? null : (
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
          )}
          {hideEnableSwitch || value.requiresVendors ? renderVendorSettings() : null}
        </div>
        ) : null}
      </div>
    </div>
  )
}

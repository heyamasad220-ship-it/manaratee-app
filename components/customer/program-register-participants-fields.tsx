"use client"

import * as React from "react"

type FamilyMember = {
  personId: string
  contactId: string | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string | null
  relationship_type: string
}

type LunchOption = {
  id: string
  name: string
  price: number | null
}

function formatRelationship(value: string) {
  const labels: Record<string, string> = {
    child: "Child / Grandchild",
    guardian: "Guardian",
    spouse: "Spouse",
    parent: "Parent",
    sibling: "Sibling",
    other: "Other",
  }

  return labels[value] || value
}

function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null

  const today = new Date()
  const birthDate = new Date(`${dateOfBirth}T00:00:00`)

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return age
}

function getFullName(person: Pick<FamilyMember, "first_name" | "last_name">) {
  return `${person.first_name || ""} ${person.last_name || ""}`.trim()
}

function formatMoney(value?: number | null) {
  const amount = Number(value || 0)

  if (amount <= 0) return "Included"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatEnrollmentStatus(status: string) {
  return status.replace(/_/g, " ")
}

function ParticipantFeeColumn({
  member,
  lunchOptions,
  showAddons,
  selected,
  onToggle,
  activeEnrollmentStatus,
}: {
  member: FamilyMember
  lunchOptions: LunchOption[]
  showAddons: boolean
  selected: boolean
  onToggle: (checked: boolean) => void
  activeEnrollmentStatus?: string | null
}) {
  const fullName = getFullName(member)
  const age = calculateAge(member.date_of_birth)
  const personId = member.personId
  const disabled = Boolean(activeEnrollmentStatus)
  const feesDisabled = disabled || !selected

  return (
    <div
      className={`flex h-full flex-col rounded-lg border bg-background ${
        disabled
          ? "opacity-60"
          : selected
            ? "border-primary ring-1 ring-primary/20"
            : ""
      }`}
    >
      <label
        className={`flex items-start gap-3 border-b px-4 py-3 text-sm ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <input
          type="checkbox"
          name="participant_person_ids"
          value={personId}
          disabled={disabled}
          checked={selected}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-1"
        />
        {member.contactId ? (
          <input
            type="hidden"
            name={`participant_${personId}_contact_id`}
            value={member.contactId}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{fullName}</p>
          <p className="text-xs text-muted-foreground">
            {formatRelationship(member.relationship_type)}
            {age !== null ? ` · Age ${age}` : ""}
            {member.gender ? ` · ${member.gender}` : ""}
          </p>
          {disabled && activeEnrollmentStatus ? (
            <p className="mt-1 text-xs text-amber-700">
              Already registered ({formatEnrollmentStatus(activeEnrollmentStatus)}).
              Contact the organization if this should be cancelled.
            </p>
          ) : null}
        </div>
      </label>

      {showAddons ? (
        <div className="flex flex-1 flex-col divide-y">
          <div className="space-y-2 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lunch
            </p>
            <select
              name={`participant_${personId}_lunch_option_id`}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              defaultValue=""
              disabled={feesDisabled}
            >
              <option value="">No lunch</option>
              {lunchOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {formatMoney(option.price)}
                </option>
              ))}
            </select>
          </div>

          <label
            className={`flex items-center gap-3 px-4 py-3 text-sm ${
              feesDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              name={`participant_${personId}_before_care`}
              disabled={feesDisabled}
              className="h-4 w-4"
            />
            <span>Before care</span>
          </label>

          <label
            className={`flex items-center gap-3 px-4 py-3 text-sm ${
              feesDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              name={`participant_${personId}_after_care`}
              disabled={feesDisabled}
              className="h-4 w-4"
            />
            <span>After care</span>
          </label>
        </div>
      ) : null}
    </div>
  )
}

export function ProgramRegisterParticipantsFields({
  familyMembers,
  lunchOptions,
  showAddons,
  activeEnrollmentByPersonId = {},
}: {
  familyMembers: FamilyMember[]
  lunchOptions: LunchOption[]
  showAddons: boolean
  activeEnrollmentByPersonId?: Record<string, string>
}) {
  const [selectedPersonIds, setSelectedPersonIds] = React.useState<string[]>([])

  function toggleParticipant(personId: string, checked: boolean) {
    setSelectedPersonIds((current) => {
      if (checked) {
        return current.includes(personId) ? current : [...current, personId]
      }

      return current.filter((id) => id !== personId)
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">
          Participants & Fees <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Select each child to register, then choose lunch and care options in
          their column.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {familyMembers.map((member) => {
          const selected = selectedPersonIds.includes(member.personId)

          return (
            <ParticipantFeeColumn
              key={member.personId}
              member={member}
              lunchOptions={lunchOptions}
              showAddons={showAddons}
              selected={selected}
              activeEnrollmentStatus={
                activeEnrollmentByPersonId[member.personId] ?? null
              }
              onToggle={(checked) =>
                toggleParticipant(member.personId, checked)
              }
            />
          )
        })}
      </div>

      {familyMembers.length > 0 && selectedPersonIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Select at least one participant to continue.
        </p>
      ) : null}
    </div>
  )
}

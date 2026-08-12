"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  ProgramApplicantType,
  ProgramApplicationAnswers,
  ProgramApplicationPaymentPreference,
  ProgramApplicationPriorBackground,
} from "@/lib/programs/program-application-types"
import {
  PROGRAM_APPLICATION_PAYMENT_PREFERENCE_LABELS,
  PROGRAM_APPLICATION_PRIOR_BACKGROUND_LABELS,
} from "@/lib/programs/program-application-types"
import { PROGRAM_LABEL_PLURAL } from "@/lib/programs/program-display-labels"

export type ProgramApplicationFormValues = {
  participantName: string
  applicantType: ProgramApplicantType
  /** Selected course IDs (multi-select). First is primary offering_id. */
  offeringIds: string[]
  answers: ProgramApplicationAnswers
}

type OfferingOption = {
  id: string
  name: string
}

type ProgramApplicationFormFieldsProps = {
  values: ProgramApplicationFormValues
  onChange: (next: ProgramApplicationFormValues) => void
  offerings: OfferingOption[]
  disabled?: boolean
  /** Show participant name field (staff detail / no family picker). */
  showParticipantName?: boolean
  idPrefix?: string
}

export function ProgramApplicationFormFields({
  values,
  onChange,
  offerings,
  disabled = false,
  showParticipantName = true,
  idPrefix = "app",
}: ProgramApplicationFormFieldsProps) {
  const isNew = values.applicantType === "new"
  const answers = values.answers
  const selected = new Set(values.offeringIds)

  function patch(partial: Partial<ProgramApplicationFormValues>) {
    onChange({ ...values, ...partial })
  }

  function patchAnswers(partial: Partial<ProgramApplicationAnswers>) {
    onChange({
      ...values,
      answers: { ...values.answers, ...partial },
    })
  }

  function toggleOffering(offeringId: string, checked: boolean) {
    const next = checked
      ? [...values.offeringIds, offeringId]
      : values.offeringIds.filter((id) => id !== offeringId)
    patch({
      offeringIds: next,
      answers: {
        ...values.answers,
        requested_offering_ids: next.length > 0 ? next : null,
      },
    })
  }

  return (
    <div className="space-y-4">
      {showParticipantName ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-full-name`}>Full name</Label>
          <Input
            id={`${idPrefix}-full-name`}
            value={values.participantName}
            onChange={(event) =>
              patch({ participantName: event.target.value })
            }
            disabled={disabled}
            placeholder="Student full name"
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label>Returning or new student</Label>
        <div className="space-y-2 rounded-md border p-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-applicant-type`}
              className="mt-1"
              checked={values.applicantType === "returning"}
              onChange={() => patch({ applicantType: "returning" })}
              disabled={disabled}
            />
            <span>
              <span className="font-medium">Returning student</span>
              <span className="block text-xs text-muted-foreground">
                Already studied with this department.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-applicant-type`}
              className="mt-1"
              checked={values.applicantType === "new"}
              onChange={() => patch({ applicantType: "new" })}
              disabled={disabled}
            />
            <span>
              <span className="font-medium">New student</span>
              <span className="block text-xs text-muted-foreground">
                First time applying to this department.
              </span>
            </span>
          </label>
        </div>
      </div>

      {isNew ? (
        <div className="space-y-4 rounded-md border bg-muted/20 p-3">
          <p className="text-sm font-medium">New student background</p>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-previous-courses`}>
              Previous courses
            </Label>
            <Textarea
              id={`${idPrefix}-previous-courses`}
              value={answers.previous_courses || ""}
              onChange={(event) =>
                patchAnswers({ previous_courses: event.target.value })
              }
              disabled={disabled}
              rows={2}
              placeholder="Courses completed elsewhere (if any)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-previous-certificates`}>
              Previous certificates
            </Label>
            <Textarea
              id={`${idPrefix}-previous-certificates`}
              value={answers.previous_certificates || ""}
              onChange={(event) =>
                patchAnswers({ previous_certificates: event.target.value })
              }
              disabled={disabled}
              rows={2}
              placeholder="Certificates or credentials (if any)"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Previous enrolment in other centres</Label>
            <div className="space-y-2 rounded-md border bg-background p-3">
              {(
                Object.keys(
                  PROGRAM_APPLICATION_PRIOR_BACKGROUND_LABELS
                ) as ProgramApplicationPriorBackground[]
              ).map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-prior-background`}
                    className="mt-1"
                    checked={answers.prior_background === value}
                    onChange={() =>
                      patchAnswers({
                        prior_background: value,
                        prior_center_name:
                          value === "starting_from_scratch"
                            ? null
                            : answers.prior_center_name,
                      })
                    }
                    disabled={disabled}
                  />
                  <span>
                    {PROGRAM_APPLICATION_PRIOR_BACKGROUND_LABELS[value]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {answers.prior_background === "moving_from_another_center" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-prior-center`}>Centre name</Label>
              <Input
                id={`${idPrefix}-prior-center`}
                value={answers.prior_center_name || ""}
                onChange={(event) =>
                  patchAnswers({ prior_center_name: event.target.value })
                }
                disabled={disabled}
                placeholder="Name of the other centre"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label>Course applying for</Label>
        <p className="text-xs text-muted-foreground">
          Select one or more {PROGRAM_LABEL_PLURAL.toLowerCase()}.
        </p>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
          {offerings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses available</p>
          ) : (
            offerings.map((offering) => {
              const checked = selected.has(offering.id)
              return (
                <label
                  key={offering.id}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) =>
                      toggleOffering(offering.id, value === true)
                    }
                    aria-label={offering.name}
                  />
                  <span>{offering.name}</span>
                </label>
              )
            })
          )}
        </div>
        {values.offeringIds.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {values.offeringIds.length} selected
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Babysitter needed?</Label>
        <div className="space-y-2 rounded-md border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-babysitter`}
              checked={answers.needs_babysitter === true}
              onChange={() => patchAnswers({ needs_babysitter: true })}
              disabled={disabled}
            />
            Yes
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-babysitter`}
              checked={answers.needs_babysitter === false}
              onChange={() => patchAnswers({ needs_babysitter: false })}
              disabled={disabled}
            />
            No
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>How would you like to pay once approved?</Label>
        <div className="space-y-2 rounded-md border p-3">
          {(
            Object.keys(
              PROGRAM_APPLICATION_PAYMENT_PREFERENCE_LABELS
            ) as ProgramApplicationPaymentPreference[]
          ).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-2 text-sm"
            >
              <input
                type="radio"
                name={`${idPrefix}-payment`}
                className="mt-1"
                checked={answers.payment_preference === value}
                onChange={() => patchAnswers({ payment_preference: value })}
                disabled={disabled}
              />
              <span>
                {PROGRAM_APPLICATION_PAYMENT_PREFERENCE_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  VOLUNTEER_AVAILABILITY_OPTIONS,
  VOLUNTEER_INTEREST_OPTIONS,
  type VolunteerApplicationData,
} from "@/lib/volunteers/volunteer-application-types"

const initialFormData: VolunteerApplicationData = {
  fullName: "",
  phone: "",
  dateOfBirth: "",
  address: "",
  areasOfInterest: [],
  skills: "",
  availability: [],
  experience: "",
  whyVolunteer: "",
  backgroundCheckConsent: false,
  emergencyContactName: "",
  emergencyContactPhone: "",
  additionalNotes: "",
}

export function VolunteerApplicationForm({
  onSubmit,
  onCancel,
  isSubmitting,
  initialData,
}: {
  onSubmit: (data: VolunteerApplicationData) => void
  onCancel: () => void
  isSubmitting: boolean
  initialData?: Partial<VolunteerApplicationData>
}) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<VolunteerApplicationData>({
    ...initialFormData,
    ...initialData,
    areasOfInterest: initialData?.areasOfInterest || [],
    availability: initialData?.availability || [],
  })
  const totalSteps = 3

  function handleChange<K extends keyof VolunteerApplicationData>(
    field: K,
    value: VolunteerApplicationData[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function toggleListValue(
    field: "areasOfInterest" | "availability",
    value: string
  ) {
    setFormData((prev) => {
      const current = prev[field]
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      }
    })
  }

  function canContinue() {
    if (currentStep === 1) {
      return Boolean(formData.fullName.trim() && formData.phone.trim())
    }
    if (currentStep === 2) {
      return (
        formData.areasOfInterest.length > 0 &&
        formData.availability.length > 0 &&
        Boolean(formData.whyVolunteer.trim())
      )
    }
    return formData.backgroundCheckConsent
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Array.from({ length: totalSteps }, (_, index) => {
          const step = index + 1
          const active = step === currentStep
          const done = step < currentStep
          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${
                  active || done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : step}
              </div>
              {step < totalSteps ? <div className="h-px w-6 bg-border" /> : null}
            </div>
          )
        })}
      </div>

      {currentStep === 1 ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium">About you</h3>
            <p className="text-xs text-muted-foreground">
              Basic contact details for your volunteer application.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="volunteer-fullName">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="volunteer-fullName"
              value={formData.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="volunteer-phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="volunteer-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="volunteer-dob">Date of birth</Label>
              <Input
                id="volunteer-dob"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="volunteer-address">Address</Label>
            <Input
              id="volunteer-address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium">Interests & availability</h3>
            <p className="text-xs text-muted-foreground">
              Tell us where you’d like to help and when you’re free.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>
              Areas of interest <span className="text-destructive">*</span>
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {VOLUNTEER_INTEREST_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={formData.areasOfInterest.includes(option)}
                    onCheckedChange={() =>
                      toggleListValue("areasOfInterest", option)
                    }
                    disabled={isSubmitting}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>
              Availability <span className="text-destructive">*</span>
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {VOLUNTEER_AVAILABILITY_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={formData.availability.includes(option)}
                    onCheckedChange={() => toggleListValue("availability", option)}
                    disabled={isSubmitting}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="volunteer-skills">Skills</Label>
            <Input
              id="volunteer-skills"
              value={formData.skills}
              onChange={(e) => handleChange("skills", e.target.value)}
              placeholder="e.g. teaching, setup, languages"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="volunteer-why">
              Why do you want to volunteer? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="volunteer-why"
              value={formData.whyVolunteer}
              onChange={(e) => handleChange("whyVolunteer", e.target.value)}
              className="min-h-24"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="volunteer-experience">Relevant experience</Label>
            <Textarea
              id="volunteer-experience"
              value={formData.experience}
              onChange={(e) => handleChange("experience", e.target.value)}
              className="min-h-20"
              disabled={isSubmitting}
            />
          </div>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium">Consent & emergency contact</h3>
            <p className="text-xs text-muted-foreground">
              Confirm screening consent and optional emergency details.
            </p>
          </div>
          <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
            <Checkbox
              checked={formData.backgroundCheckConsent}
              onCheckedChange={(checked) =>
                handleChange("backgroundCheckConsent", Boolean(checked))
              }
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <span>
              I consent to a background check if required for volunteer roles.{" "}
              <span className="text-destructive">*</span>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="volunteer-emergency-name">Emergency contact name</Label>
              <Input
                id="volunteer-emergency-name"
                value={formData.emergencyContactName}
                onChange={(e) =>
                  handleChange("emergencyContactName", e.target.value)
                }
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="volunteer-emergency-phone">Emergency contact phone</Label>
              <Input
                id="volunteer-emergency-phone"
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={(e) =>
                  handleChange("emergencyContactPhone", e.target.value)
                }
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="volunteer-notes">Additional notes</Label>
            <Textarea
              id="volunteer-notes"
              value={formData.additionalNotes}
              onChange={(e) => handleChange("additionalNotes", e.target.value)}
              className="min-h-20"
              disabled={isSubmitting}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (currentStep === 1) {
              onCancel()
              return
            }
            setCurrentStep((step) => Math.max(1, step - 1))
          }}
          disabled={isSubmitting}
        >
          {currentStep === 1 ? "Cancel" : "Back"}
        </Button>
        {currentStep < totalSteps ? (
          <Button
            type="button"
            onClick={() => setCurrentStep((step) => Math.min(totalSteps, step + 1))}
            disabled={!canContinue() || isSubmitting}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => onSubmit(formData)}
            disabled={!canContinue() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit application"
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

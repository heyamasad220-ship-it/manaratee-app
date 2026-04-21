"use client"

import { useState } from "react"
import { Loader2, Plus, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  ageGroups, 
  childcareServices, 
  type ChildcareApplicationData,
  type AgeGroupType,
  type ChildcareServiceType
} from "@/lib/mock-data"

interface ChildcareApplicationFormProps {
  onSubmit: (data: ChildcareApplicationData) => void
  onCancel: () => void
  isSubmitting: boolean
}

const initialFormData: ChildcareApplicationData = {
  fullName: "",
  dateOfBirth: "",
  phone: "",
  address: "",
  yearsExperience: "",
  ageGroupsExperience: [],
  servicesOffered: [],
  specialSkills: "",
  hasCPRCertification: false,
  cprExpirationDate: "",
  hasFirstAidCertification: false,
  firstAidExpirationDate: "",
  otherCertifications: "",
  backgroundCheckConsent: false,
  references: [{ name: "", relationship: "", phone: "", email: "" }],
  availability: {
    weekdayMornings: false,
    weekdayAfternoons: false,
    weekdayEvenings: false,
    weekendMornings: false,
    weekendAfternoons: false,
    weekendEvenings: false,
    overnights: false,
  },
  hourlyRateMin: "",
  hourlyRateMax: "",
  hasTransportation: false,
  willingToTravel: false,
  maxTravelDistance: "",
  whyChildcare: "",
  additionalNotes: "",
}

export function ChildcareApplicationForm({ onSubmit, onCancel, isSubmitting }: ChildcareApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<ChildcareApplicationData>(initialFormData)
  const totalSteps = 5

  function handleInputChange(field: keyof ChildcareApplicationData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function handleAgeGroupToggle(ageGroup: AgeGroupType) {
    setFormData((prev) => ({
      ...prev,
      ageGroupsExperience: prev.ageGroupsExperience.includes(ageGroup)
        ? prev.ageGroupsExperience.filter((a) => a !== ageGroup)
        : [...prev.ageGroupsExperience, ageGroup],
    }))
  }

  function handleServiceToggle(service: ChildcareServiceType) {
    setFormData((prev) => ({
      ...prev,
      servicesOffered: prev.servicesOffered.includes(service)
        ? prev.servicesOffered.filter((s) => s !== service)
        : [...prev.servicesOffered, service],
    }))
  }

  function handleAvailabilityChange(field: keyof ChildcareApplicationData["availability"], value: boolean) {
    setFormData((prev) => ({
      ...prev,
      availability: { ...prev.availability, [field]: value },
    }))
  }

  function handleReferenceChange(index: number, field: keyof ChildcareApplicationData["references"][0], value: string) {
    setFormData((prev) => ({
      ...prev,
      references: prev.references.map((ref, i) => (i === index ? { ...ref, [field]: value } : ref)),
    }))
  }

  function addReference() {
    setFormData((prev) => ({
      ...prev,
      references: [...prev.references, { name: "", relationship: "", phone: "", email: "" }],
    }))
  }

  function removeReference(index: number) {
    if (formData.references.length > 1) {
      setFormData((prev) => ({
        ...prev,
        references: prev.references.filter((_, i) => i !== index),
      }))
    }
  }

  function handleSubmit() {
    onSubmit(formData)
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.fullName && formData.dateOfBirth && formData.phone && formData.address
      case 2:
        return formData.yearsExperience && formData.ageGroupsExperience.length > 0 && formData.servicesOffered.length > 0
      case 3:
        return formData.backgroundCheckConsent && formData.references[0].name && formData.references[0].phone
      case 4:
        return Object.values(formData.availability).some((v) => v) && formData.hourlyRateMin
      case 5:
        return formData.whyChildcare
      default:
        return false
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progress Indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                i + 1 === currentStep
                  ? "bg-primary text-primary-foreground"
                  : i + 1 < currentStep
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1 < currentStep ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < totalSteps - 1 && <div className={`h-0.5 w-6 ${i + 1 < currentStep ? "bg-emerald-500" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Personal Information */}
      {currentStep === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
            <p className="text-xs text-muted-foreground">Basic contact details for your application</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="fullName"
                placeholder="Your full legal name"
                value={formData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dateOfBirth">Date of Birth <span className="text-destructive">*</span></Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-2">
              <Label htmlFor="address">Address <span className="text-destructive">*</span></Label>
              <Input
                id="address"
                placeholder="Full address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Experience & Services */}
      {currentStep === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Experience & Services</h3>
            <p className="text-xs text-muted-foreground">Tell us about your childcare experience</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Label htmlFor="yearsExperience">Years of Childcare Experience <span className="text-destructive">*</span></Label>
            <Input
              id="yearsExperience"
              placeholder="e.g., 3 years"
              value={formData.yearsExperience}
              onChange={(e) => handleInputChange("yearsExperience", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Age Groups You Have Experience With <span className="text-destructive">*</span></Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ageGroups.map((ageGroup) => (
                <div key={ageGroup} className="flex items-center gap-2">
                  <Checkbox
                    id={`age-${ageGroup}`}
                    checked={formData.ageGroupsExperience.includes(ageGroup)}
                    onCheckedChange={() => handleAgeGroupToggle(ageGroup)}
                  />
                  <Label htmlFor={`age-${ageGroup}`} className="text-sm font-normal cursor-pointer">
                    {ageGroup}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Services You Can Offer <span className="text-destructive">*</span></Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {childcareServices.map((service) => (
                <div key={service} className="flex items-center gap-2">
                  <Checkbox
                    id={`service-${service}`}
                    checked={formData.servicesOffered.includes(service)}
                    onCheckedChange={() => handleServiceToggle(service)}
                  />
                  <Label htmlFor={`service-${service}`} className="text-sm font-normal cursor-pointer">
                    {service}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="specialSkills">Special Skills (Languages, Special Needs Experience, etc.)</Label>
            <Textarea
              id="specialSkills"
              placeholder="e.g., Fluent in Spanish, experience with autism spectrum children..."
              value={formData.specialSkills}
              onChange={(e) => handleInputChange("specialSkills", e.target.value)}
              className="min-h-20 resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 3: Certifications & References */}
      {currentStep === 3 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Certifications & References</h3>
            <p className="text-xs text-muted-foreground">Safety certifications and professional references</p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="mb-3 text-sm font-medium">Certifications</h4>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="cpr" className="font-normal">CPR Certification</Label>
                  <span className="text-xs text-muted-foreground">Current CPR certification</span>
                </div>
                <Switch
                  id="cpr"
                  checked={formData.hasCPRCertification}
                  onCheckedChange={(checked) => handleInputChange("hasCPRCertification", checked)}
                />
              </div>
              {formData.hasCPRCertification && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cprExpiration">CPR Expiration Date</Label>
                  <Input
                    id="cprExpiration"
                    type="date"
                    value={formData.cprExpirationDate}
                    onChange={(e) => handleInputChange("cprExpirationDate", e.target.value)}
                  />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="firstAid" className="font-normal">First Aid Certification</Label>
                  <span className="text-xs text-muted-foreground">Current First Aid certification</span>
                </div>
                <Switch
                  id="firstAid"
                  checked={formData.hasFirstAidCertification}
                  onCheckedChange={(checked) => handleInputChange("hasFirstAidCertification", checked)}
                />
              </div>
              {formData.hasFirstAidCertification && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="firstAidExpiration">First Aid Expiration Date</Label>
                  <Input
                    id="firstAidExpiration"
                    type="date"
                    value={formData.firstAidExpirationDate}
                    onChange={(e) => handleInputChange("firstAidExpirationDate", e.target.value)}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="otherCerts">Other Certifications</Label>
                <Textarea
                  id="otherCerts"
                  placeholder="e.g., Early Childhood Education, Child Development Associate..."
                  value={formData.otherCertifications}
                  onChange={(e) => handleInputChange("otherCertifications", e.target.value)}
                  className="min-h-16 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Checkbox
              id="bgCheck"
              checked={formData.backgroundCheckConsent}
              onCheckedChange={(checked) => handleInputChange("backgroundCheckConsent", checked as boolean)}
            />
            <Label htmlFor="bgCheck" className="text-sm font-normal cursor-pointer">
              I consent to a background check as part of this application <span className="text-destructive">*</span>
            </Label>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>References <span className="text-destructive">*</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addReference}>
                <Plus className="mr-1 h-3 w-3" />
                Add Reference
              </Button>
            </div>
            {formData.references.map((ref, index) => (
              <div key={index} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Reference {index + 1}</span>
                  {formData.references.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeReference(index)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Name"
                    value={ref.name}
                    onChange={(e) => handleReferenceChange(index, "name", e.target.value)}
                  />
                  <Input
                    placeholder="Relationship (e.g., Former Employer)"
                    value={ref.relationship}
                    onChange={(e) => handleReferenceChange(index, "relationship", e.target.value)}
                  />
                  <Input
                    placeholder="Phone"
                    type="tel"
                    value={ref.phone}
                    onChange={(e) => handleReferenceChange(index, "phone", e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={ref.email}
                    onChange={(e) => handleReferenceChange(index, "email", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Availability & Compensation */}
      {currentStep === 4 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Availability & Compensation</h3>
            <p className="text-xs text-muted-foreground">When are you available and what are your rates?</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Availability <span className="text-destructive">*</span></Label>
            <div className="rounded-lg border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekday Mornings</span>
                  <Switch
                    checked={formData.availability.weekdayMornings}
                    onCheckedChange={(checked) => handleAvailabilityChange("weekdayMornings", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekday Afternoons</span>
                  <Switch
                    checked={formData.availability.weekdayAfternoons}
                    onCheckedChange={(checked) => handleAvailabilityChange("weekdayAfternoons", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekday Evenings</span>
                  <Switch
                    checked={formData.availability.weekdayEvenings}
                    onCheckedChange={(checked) => handleAvailabilityChange("weekdayEvenings", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekend Mornings</span>
                  <Switch
                    checked={formData.availability.weekendMornings}
                    onCheckedChange={(checked) => handleAvailabilityChange("weekendMornings", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekend Afternoons</span>
                  <Switch
                    checked={formData.availability.weekendAfternoons}
                    onCheckedChange={(checked) => handleAvailabilityChange("weekendAfternoons", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekend Evenings</span>
                  <Switch
                    checked={formData.availability.weekendEvenings}
                    onCheckedChange={(checked) => handleAvailabilityChange("weekendEvenings", checked)}
                  />
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <span className="text-sm">Overnight Care</span>
                  <Switch
                    checked={formData.availability.overnights}
                    onCheckedChange={(checked) => handleAvailabilityChange("overnights", checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rateMin">Minimum Hourly Rate ($) <span className="text-destructive">*</span></Label>
              <Input
                id="rateMin"
                type="number"
                placeholder="15"
                value={formData.hourlyRateMin}
                onChange={(e) => handleInputChange("hourlyRateMin", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rateMax">Maximum Hourly Rate ($)</Label>
              <Input
                id="rateMax"
                type="number"
                placeholder="25"
                value={formData.hourlyRateMax}
                onChange={(e) => handleInputChange("hourlyRateMax", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <Label>Transportation</Label>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Do you have your own transportation?</span>
              <Switch
                checked={formData.hasTransportation}
                onCheckedChange={(checked) => handleInputChange("hasTransportation", checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Willing to travel to client homes?</span>
              <Switch
                checked={formData.willingToTravel}
                onCheckedChange={(checked) => handleInputChange("willingToTravel", checked)}
              />
            </div>
            {formData.willingToTravel && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="maxTravel">Maximum Travel Distance (miles)</Label>
                <Input
                  id="maxTravel"
                  type="number"
                  placeholder="e.g., 15"
                  value={formData.maxTravelDistance}
                  onChange={(e) => handleInputChange("maxTravelDistance", e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Additional Information */}
      {currentStep === 5 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Additional Information</h3>
            <p className="text-xs text-muted-foreground">Tell us more about yourself</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="whyChildcare">Why do you want to provide childcare? <span className="text-destructive">*</span></Label>
            <Textarea
              id="whyChildcare"
              placeholder="Tell us about your passion for working with children and why you would be a great caregiver..."
              value={formData.whyChildcare}
              onChange={(e) => handleInputChange("whyChildcare", e.target.value)}
              className="min-h-24 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="additionalNotes">Additional Notes</Label>
            <Textarea
              id="additionalNotes"
              placeholder="Any other information you would like us to know..."
              value={formData.additionalNotes}
              onChange={(e) => handleInputChange("additionalNotes", e.target.value)}
              className="min-h-20 resize-none"
            />
          </div>

          {/* Application Summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="mb-3 text-sm font-medium">Application Summary</h4>
            <div className="grid gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Experience:</span>
                <span className="font-medium">{formData.yearsExperience || "Not specified"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age Groups:</span>
                <span className="font-medium">{formData.ageGroupsExperience.length} selected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Services:</span>
                <span className="font-medium">{formData.servicesOffered.length} selected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hourly Rate:</span>
                <span className="font-medium">
                  ${formData.hourlyRateMin || "0"}{formData.hourlyRateMax ? ` - $${formData.hourlyRateMax}` : "+"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPR Certified:</span>
                <span className="font-medium">{formData.hasCPRCertification ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First Aid Certified:</span>
                <span className="font-medium">{formData.hasFirstAidCertification ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">References:</span>
                <span className="font-medium">{formData.references.filter((r) => r.name).length} provided</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onClick={currentStep === 1 ? onCancel : () => setCurrentStep((s) => s - 1)}>
          {currentStep === 1 ? "Cancel" : "Back"}
        </Button>
        {currentStep < totalSteps ? (
          <Button type="button" onClick={() => setCurrentStep((s) => s + 1)} disabled={!canProceed()}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !canProceed()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Application"
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

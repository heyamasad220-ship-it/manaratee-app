"use client"

import { useState } from "react"
import { 
  Store, Upload, Globe, Loader2, Check, X,
  Facebook, Instagram, Twitter, Linkedin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { 
  businessTypes, 
  type BusinessType, 
  type VendorApplicationData 
} from "@/lib/mock-data"

// TikTok icon component (not in lucide)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  )
}

const eventTypes = [
  "Festivals & Fairs",
  "Farmers Markets",
  "Community Events",
  "Corporate Events",
  "Weddings & Celebrations",
  "Holiday Events",
  "Fundraisers",
  "Sports Events",
  "Cultural Events",
  "Educational Events",
]

interface VendorApplicationFormProps {
  onSubmit: (data: VendorApplicationData) => void
  onCancel: () => void
  isSubmitting: boolean
}

export function VendorApplicationForm({ onSubmit, onCancel, isSubmitting }: VendorApplicationFormProps) {
  const [formData, setFormData] = useState<VendorApplicationData>({
    businessName: "",
    businessType: "",
    description: "",
    logo: "",
    contactName: "",
    phone: "",
    address: "",
    socialMedia: {
      facebook: "",
      instagram: "",
      twitter: "",
      tiktok: "",
      linkedin: "",
      website: "",
    },
    yearsInBusiness: "",
    productsServices: "",
    preferredEventTypes: [],
    insuranceInfo: "",
  })

  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3

  function handleChange<K extends keyof VendorApplicationData>(
    field: K, 
    value: VendorApplicationData[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function handleSocialMediaChange(platform: keyof VendorApplicationData["socialMedia"], value: string) {
    setFormData((prev) => ({
      ...prev,
      socialMedia: { ...prev.socialMedia, [platform]: value },
    }))
  }

  function handleEventTypeToggle(eventType: string) {
    setFormData((prev) => ({
      ...prev,
      preferredEventTypes: prev.preferredEventTypes.includes(eventType)
        ? prev.preferredEventTypes.filter((t) => t !== eventType)
        : [...prev.preferredEventTypes, eventType],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(formData)
  }

  const canProceedStep1 = formData.businessName && formData.businessType && formData.contactName && formData.phone
  const canProceedStep2 = formData.description && formData.productsServices
  const canSubmit = canProceedStep1 && canProceedStep2 && formData.preferredEventTypes.length > 0

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === currentStep
                    ? "bg-primary text-primary-foreground"
                    : step < currentStep
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step < currentStep ? <Check className="h-4 w-4" /> : step}
              </div>
              {step < totalSteps && (
                <div className={`h-0.5 w-8 ${step < currentStep ? "bg-emerald-500" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Step {currentStep} of {totalSteps}</span>
      </div>

      {/* Step 1: Business Information */}
      {currentStep === 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">Business Information</h3>
            <p className="text-xs text-muted-foreground">Tell us about your business</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="businessName">Business Name <span className="text-destructive">*</span></Label>
              <Input
                id="businessName"
                placeholder="Your Business Name"
                value={formData.businessName}
                onChange={(e) => handleChange("businessName", e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="businessType">Business Type <span className="text-destructive">*</span></Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) => handleChange("businessType", value as BusinessType)}
              >
                <SelectTrigger id="businessType">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  {businessTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contactName">Contact Name <span className="text-destructive">*</span></Label>
              <Input
                id="contactName"
                placeholder="Primary contact person"
                value={formData.contactName}
                onChange={(e) => handleChange("contactName", e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Business Address</Label>
            <Input
              id="address"
              placeholder="Street address, City, State, ZIP"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="yearsInBusiness">Years in Business</Label>
            <Select
              value={formData.yearsInBusiness}
              onValueChange={(value) => handleChange("yearsInBusiness", value)}
            >
              <SelectTrigger id="yearsInBusiness">
                <SelectValue placeholder="Select years in business" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="less-than-1">Less than 1 year</SelectItem>
                <SelectItem value="1-2">1-2 years</SelectItem>
                <SelectItem value="3-5">3-5 years</SelectItem>
                <SelectItem value="5-10">5-10 years</SelectItem>
                <SelectItem value="10+">10+ years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Business Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30">
                {formData.logo ? (
                  <img src={formData.logo} alt="Logo preview" className="h-full w-full rounded-lg object-cover" />
                ) : (
                  <Store className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <Button type="button" variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Upload Logo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Recommended: Square image, at least 200x200px</p>
          </div>
        </div>
      )}

      {/* Step 2: Products & Services */}
      {currentStep === 2 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">Products & Services</h3>
            <p className="text-xs text-muted-foreground">Describe what you offer</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Business Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="description"
              placeholder="Tell us about your business, your story, and what makes you unique..."
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="min-h-24 resize-none"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="productsServices">Products/Services Offered <span className="text-destructive">*</span></Label>
            <Textarea
              id="productsServices"
              placeholder="List the products or services you plan to offer at events..."
              value={formData.productsServices}
              onChange={(e) => handleChange("productsServices", e.target.value)}
              className="min-h-24 resize-none"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="insuranceInfo">Insurance Information</Label>
            <Textarea
              id="insuranceInfo"
              placeholder="Provide details about your liability insurance coverage..."
              value={formData.insuranceInfo}
              onChange={(e) => handleChange("insuranceInfo", e.target.value)}
              className="min-h-20 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Proof of insurance may be required before participating in events
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label>Social Media & Website</Label>
              <p className="text-xs text-muted-foreground">Help customers find you online (all optional)</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Website URL"
                  value={formData.socialMedia.website}
                  onChange={(e) => handleSocialMediaChange("website", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Facebook page URL"
                  value={formData.socialMedia.facebook}
                  onChange={(e) => handleSocialMediaChange("facebook", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Instagram handle"
                  value={formData.socialMedia.instagram}
                  onChange={(e) => handleSocialMediaChange("instagram", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Twitter/X handle"
                  value={formData.socialMedia.twitter}
                  onChange={(e) => handleSocialMediaChange("twitter", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <TikTokIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="TikTok handle"
                  value={formData.socialMedia.tiktok}
                  onChange={(e) => handleSocialMediaChange("tiktok", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="LinkedIn URL"
                  value={formData.socialMedia.linkedin}
                  onChange={(e) => handleSocialMediaChange("linkedin", e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Event Preferences */}
      {currentStep === 3 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">Event Preferences</h3>
            <p className="text-xs text-muted-foreground">Select the types of events you are interested in</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Preferred Event Types <span className="text-destructive">*</span></Label>
            <p className="text-xs text-muted-foreground">Select all that apply</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {eventTypes.map((eventType) => (
                <div
                  key={eventType}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <Checkbox
                    id={eventType}
                    checked={formData.preferredEventTypes.includes(eventType)}
                    onCheckedChange={() => handleEventTypeToggle(eventType)}
                  />
                  <Label htmlFor={eventType} className="cursor-pointer text-sm font-normal">
                    {eventType}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="mb-3 text-sm font-medium text-foreground">Application Summary</h4>
            <div className="grid gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Business Name:</span>
                <span className="font-medium text-foreground">{formData.businessName || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Business Type:</span>
                <span className="font-medium text-foreground">{formData.businessType || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact:</span>
                <span className="font-medium text-foreground">{formData.contactName || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium text-foreground">{formData.phone || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event Types:</span>
                <span className="font-medium text-foreground">{formData.preferredEventTypes.length} selected</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {currentStep < totalSteps ? (
            <Button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={currentStep === 1 ? !canProceedStep1 : !canProceedStep2}
            >
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
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
    </form>
  )
}

export type VolunteerApplicationData = {
  fullName: string
  phone: string
  dateOfBirth: string
  address: string
  areasOfInterest: string[]
  skills: string
  availability: string[]
  experience: string
  whyVolunteer: string
  backgroundCheckConsent: boolean
  emergencyContactName: string
  emergencyContactPhone: string
  additionalNotes: string
}

export const VOLUNTEER_INTEREST_OPTIONS = [
  "Events",
  "Programs",
  "Hospitality",
  "Admin / Office",
  "Youth",
  "Fundraising",
  "Facilities",
  "Communications",
  "Other",
] as const

export const VOLUNTEER_AVAILABILITY_OPTIONS = [
  "Weekday mornings",
  "Weekday afternoons",
  "Weekday evenings",
  "Weekend mornings",
  "Weekend afternoons",
  "Weekend evenings",
  "As needed / flexible",
] as const

// ==========================================
// Types
// ==========================================

export type EventStatus = "Published" | "Draft" | "Sales Closed"

export interface Event {
  id: string
  name: string
  status: EventStatus
  date: string
  time?: string
  venue: string
  ticketsIssued: number
  revenue: number
}

export type OrderStatus = "Completed" | "Pending" | "Canceled" | "Refunded"

export interface Order {
  id: string
  customer: {
    name: string
    email: string
  }
  event: string
  eventLocation?: string
  paymentMethod: string
  orderDate: string
  orderTime: string
  total: number
  status: OrderStatus
  transactionId: string
  billingAddress: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
}

export type TeamRole = "super_admin" | "Admin" | "Editor" | "Viewer"

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  avatar?: string
}

export interface DiscountCode {
  id: string
  code: string
  label?: string
  type: "Percentage" | "Fixed"
  discount: number
  usageCount: number
  usageLimit: number | null
  status: "Active" | "Expired" | "Inactive"
  activeFrom: string
  activeTo: string
}

// ==========================================
// Shared collections (empty — no sample rows)
// ==========================================

export const upcomingEvents: Event[] = []

export const pastEvents: Event[] = []

export const allEvents: Event[] = []

export const orders: Order[] = []

export const teamMembers: TeamMember[] = []

export const discountCodes: DiscountCode[] = []

// ==========================================
// Sign-Ups
// ==========================================

export type SignUpStatus = "Published" | "Draft" | "Closed"

export type SignUpSchedule = "Upcoming" | "Past"

export interface SignUp {
  id: string
  title: string
  startDate: string
  schedule: SignUpSchedule
  groupName: string
  status: SignUpStatus
}

export interface SignUpGroup {
  id: string
  name: string
  members: number
  signUps: number
  status: "Published" | "Draft"
}

export interface SignUpMessage {
  id: string
  sentDate: string
  subject: string
  type: "Sent" | "Draft" | "Scheduled"
}

export const signUps: SignUp[] = []

export const signUpGroups: SignUpGroup[] = []

export const signUpMessages: SignUpMessage[] = []

// ==========================================
// Bookings
// ==========================================

export type BookingStatus = "Approved" | "Confirmed" | "Cancelled" | "Rejected"

export interface Booking {
  id: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  space: string
  title: string
  booker: string
  status: BookingStatus
}

export interface BookingCalendarEntry {
  id: string
  timeSlot: string
  eventDate: string
  space: string
  location: string
  status: string
  booker: string
}

export interface BookingSpace {
  id: string
  name: string
  capacity: number
  hours: string
  peakFlat: string
  peakHourly: string
  nonPeakFlat: string
  nonPeakHourly: string
  tag: "Internal" | "External"
  status: "Published" | "Draft"
}

export const bookings: Booking[] = []

export const bookingCalendar: BookingCalendarEntry[] = []

export interface CalendarGridEvent {
  id: string
  title: string
  space: string
  startHour: number
  durationHours: number
  color: string
  booker: string
}

export const calendarSpaces: string[] = []

export const calendarGridEvents: CalendarGridEvent[] = []

export interface CalendarGridWeekEvent {
  id: string
  time: string
  title: string
  space: string
  dayIndex: number // 0=SUN, 1=MON, 2=TUE, ...
  color: string
}

export const calendarGridWeekEvents: CalendarGridWeekEvent[] = []

export interface CalendarListEvent {
  id: string
  startTime: string
  endTime: string
  duration: string
  recurring: boolean
  space: string
  booker: string
  date: string // e.g. "2026-03-07"
  dateLabel: string // e.g. "SATURDAY, MARCH 7, 2026"
}

export const calendarListEvents: CalendarListEvent[] = []

export const bookingSpaces: BookingSpace[] = []

// ==========================================
// Application Types (Admin Configurable)
// ==========================================

export type ApplicationStatus = "Pending" | "Approved" | "Rejected" | "Under Review"

export type BusinessType =
  | "Clothing"
  | "Decorations"
  | "Food & Catering"
  | "Photography"
  | "Entertainment"
  | "Flowers & Plants"
  | "Jewelry & Accessories"
  | "Arts & Crafts"
  | "Health & Beauty"
  | "Home Goods"
  | "Other"

/** Form option labels (not sample table rows). */
export const businessTypes: BusinessType[] = [
  "Clothing",
  "Decorations",
  "Food & Catering",
  "Photography",
  "Entertainment",
  "Flowers & Plants",
  "Jewelry & Accessories",
  "Arts & Crafts",
  "Health & Beauty",
  "Home Goods",
  "Other",
]

export interface VendorApplicationData {
  businessName: string
  businessType: BusinessType | ""
  description: string
  logo: string // URL or base64
  contactName: string
  phone: string
  address: string
  socialMedia: {
    facebook: string
    instagram: string
    twitter: string
    tiktok: string
    linkedin: string
    website: string
  }
  yearsInBusiness: string
  productsServices: string
  preferredEventTypes: string[]
  insuranceInfo: string
}

// Childcare Application Types
export type AgeGroupType =
  | "Infants (0-12 months)"
  | "Toddlers (1-3 years)"
  | "Preschool (3-5 years)"
  | "School Age (5-12 years)"
  | "Teenagers (13-17 years)"

/** Form option labels (not sample table rows). */
export const ageGroups: AgeGroupType[] = [
  "Infants (0-12 months)",
  "Toddlers (1-3 years)",
  "Preschool (3-5 years)",
  "School Age (5-12 years)",
  "Teenagers (13-17 years)",
]

export type ChildcareServiceType =
  | "Babysitting"
  | "After School Care"
  | "Overnight Care"
  | "Weekend Care"
  | "Drop-in Care"
  | "Tutoring"
  | "Special Needs Care"
  | "Newborn Care"

/** Form option labels (not sample table rows). */
export const childcareServices: ChildcareServiceType[] = [
  "Babysitting",
  "After School Care",
  "Overnight Care",
  "Weekend Care",
  "Drop-in Care",
  "Tutoring",
  "Special Needs Care",
  "Newborn Care",
]

export interface ChildcareApplicationData {
  // Personal Information
  fullName: string
  dateOfBirth: string
  phone: string
  address: string

  // Experience & Qualifications
  yearsExperience: string
  ageGroupsExperience: AgeGroupType[]
  servicesOffered: ChildcareServiceType[]
  specialSkills: string // Languages, special needs experience, etc.

  // Certifications
  hasCPRCertification: boolean
  cprExpirationDate: string
  hasFirstAidCertification: boolean
  firstAidExpirationDate: string
  otherCertifications: string

  // Background & References
  backgroundCheckConsent: boolean
  references: {
    name: string
    relationship: string
    phone: string
    email: string
  }[]

  // Availability & Compensation
  availability: {
    weekdayMornings: boolean
    weekdayAfternoons: boolean
    weekdayEvenings: boolean
    weekendMornings: boolean
    weekendAfternoons: boolean
    weekendEvenings: boolean
    overnights: boolean
  }
  hourlyRateMin: string
  hourlyRateMax: string

  // Transportation
  hasTransportation: boolean
  willingToTravel: boolean
  maxTravelDistance: string

  // Additional Information
  whyChildcare: string
  additionalNotes: string
}

export interface ApplicationType {
  id: string
  name: string
  description: string
  icon: string // Icon name to use
  requirements: string[]
  isActive: boolean // Admin can enable/disable
  createdAt: string
  formType?: "vendor" | "childcare" | "generic" // Custom form type
}

export interface UserApplication {
  id: string
  userId: string
  applicationTypeId: string
  applicationTypeName: string
  status: ApplicationStatus
  submittedAt: string
  reviewedAt?: string
  reviewerNotes?: string
  answers: Record<string, string>
  vendorData?: VendorApplicationData // For vendor applications
  childcareData?: ChildcareApplicationData // For childcare applications
}

export const applicationTypes: ApplicationType[] = []

export const userApplications: UserApplication[] = []

// ==========================================
// Customer Transactions & Enrollments
// ==========================================

export type EnrollmentStatus = "Active" | "Inactive" | "Cancelled" | "Completed" | "Past Due"
export type EnrollmentType = "Program" | "Service" | "Subscription" | "Membership" | "Class"

export interface PaymentRecord {
  id: string
  date: string
  amount: number
  status: "Paid" | "Pending" | "Failed" | "Refunded"
  method: string
  transactionId: string
  failureReason?: string
}

export interface CustomerEnrollment {
  id: string
  name: string
  type: EnrollmentType
  description: string
  status: EnrollmentStatus
  startDate: string
  endDate?: string
  billingCycle?: "Monthly" | "Quarterly" | "Annually" | "One-time"
  amount: number
  nextPaymentDate?: string
  totalPaid: number
  payments: PaymentRecord[]
}

export const customerEnrollments: CustomerEnrollment[] = []

// ==========================================
// Overview Stats
// ==========================================

export const overviewStats = {
  nextEventIn: { days: 0, eventName: "", date: "" },
  publishedEvents: { count: 0, label: "Active" },
  ordersReceived: 0,
  ticketsIssued: 0,
  totalRevenue: { amount: 0, label: "Gross" },
}

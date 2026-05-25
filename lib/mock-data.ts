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
// Mock Data
// ==========================================

export const upcomingEvents: Event[] = [
  {
    id: "evt-1",
    name: "Spring Gala",
    status: "Published",
    date: "Mar 2, 2026",
    time: "6:00 PM - 10:00 PM",
    venue: "Internal",
    ticketsIssued: 120,
    revenue: 6250.0,
  },
  {
    id: "evt-2",
    name: "Member Meetup",
    status: "Published",
    date: "Mar 18, 2026",
    time: "7:00 PM - 9:00 PM",
    venue: "Online",
    ticketsIssued: 45,
    revenue: 900.0,
  },
  {
    id: "evt-3",
    name: "Annual Fundraiser",
    status: "Draft",
    date: "Apr 27, 2026",
    time: "5:00 PM - 9:00 PM",
    venue: "External Venue",
    ticketsIssued: 0,
    revenue: 0,
  },
]

export const pastEvents: Event[] = [
  {
    id: "evt-4",
    name: "Tech Expo 2026",
    status: "Sales Closed",
    date: "Jan 15, 2026",
    venue: "External Venue",
    ticketsIssued: 388,
    revenue: 4200.0,
  },
  {
    id: "evt-5",
    name: "Holiday Party",
    status: "Published",
    date: "Dec 20, 2025",
    time: "7:00 PM - 10:00 PM",
    venue: "Internal",
    ticketsIssued: 98,
    revenue: 1490.0,
  },
  {
    id: "evt-6",
    name: "Networking Breakfast",
    status: "Published",
    date: "Nov 5, 2025",
    time: "6:00 AM - 10:00 AM",
    venue: "External Venue",
    ticketsIssued: 75,
    revenue: 0,
  },
  {
    id: "evt-7",
    name: "Annual Conference",
    status: "Draft",
    date: "Sep 10-12, 2025",
    time: "6:00 AM - 9:00",
    venue: "Internal",
    ticketsIssued: 0,
    revenue: 0,
  },
]

export const allEvents: Event[] = [
  ...upcomingEvents,
  {
    id: "evt-8",
    name: "Summer Festival",
    status: "Draft",
    date: "Jul 15, 2026",
    venue: "Online",
    ticketsIssued: 0,
    revenue: 0,
  },
]

export const orders: Order[] = [
  {
    id: "#1008",
    customer: { name: "Roberta Diaz", email: "robertadiaa@email.com" },
    event: "Spring Gala",
    eventLocation: "Chicago, IL",
    paymentMethod: "Visa",
    orderDate: "Mar 2, 2026",
    orderTime: "0:36 PM, 10:24 AM",
    total: 120.0,
    status: "Completed",
    transactionId: "#30410US7190",
    billingAddress: {
      street: "125 Odt 51 ...",
      city: "Chicago",
      state: "IL",
      zip: "505.10",
      country: "USA",
    },
  },
  {
    id: "#1029",
    customer: { name: "Ethan Brooks", email: "phoertaiata@email.com" },
    event: "Tech Expo 2026",
    eventLocation: "New York, NY",
    paymentMethod: "tech ypr:.r7526",
    orderDate: "Jan 15, 2026",
    orderTime: "9:16 PM, 9:56 AM",
    total: 325.0,
    status: "Pending",
    transactionId: "#28901US4521",
    billingAddress: {
      street: "456 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
      country: "USA",
    },
  },
  {
    id: "#1003",
    customer: { name: "Isabelle Perez", email: "pthng@email.com" },
    event: "Holiday Party",
    eventLocation: "Boston, MA",
    paymentMethod: "Visa",
    orderDate: "Dec 20, 2025",
    orderTime: "0:28 PM, 2:15 PM",
    total: 50.0,
    status: "Canceled",
    transactionId: "#19283US8732",
    billingAddress: {
      street: "789 Oak Ave",
      city: "Boston",
      state: "MA",
      zip: "02101",
      country: "USA",
    },
  },
  {
    id: "#1002",
    customer: { name: "John Smith", email: "phnestire@email.com" },
    event: "Member Meetup",
    eventLocation: "Online",
    paymentMethod: "Visa",
    orderDate: "Mar 18, 2026",
    orderTime: "0:10 AM, 1:45 AM",
    total: 25.0,
    status: "Refunded",
    transactionId: "#45678US2341",
    billingAddress: {
      street: "321 Pine St",
      city: "Denver",
      state: "CO",
      zip: "80201",
      country: "USA",
    },
  },
  {
    id: "#1003",
    customer: { name: "Jessica Lee", email: "pesicailee@email.com" },
    event: "Networking Breakfast",
    eventLocation: "Seattle, WA",
    paymentMethod: "Visa",
    orderDate: "Nov 5, 2025",
    orderTime: "7:20 AM",
    total: 30.0,
    status: "Completed",
    transactionId: "#67890US5678",
    billingAddress: {
      street: "555 Elm St",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      country: "USA",
    },
  },
]

export const teamMembers: TeamMember[] = [
  {
    id: "tm-1",
    name: "Alex Tremo",
    email: "super_admin",
    role: "super_admin",
  },
  {
    id: "tm-2",
    name: "Sarah Connor",
    email: "Admin",
    role: "Admin",
  },
  {
    id: "tm-3",
    name: "James Lee",
    email: "Editor",
    role: "Editor",
  },
  {
    id: "tm-4",
    name: "Megan Nelson",
    email: "Viewer",
    role: "Viewer",
  },
]

export const discountCodes: DiscountCode[] = [
  {
    id: "dc-1",
    code: "SAVE20",
    label: "Save 20%",
    type: "Percentage",
    discount: 20,
    usageCount: 47,
    usageLimit: 100,
    status: "Active",
    activeFrom: "Apr 15, 2024",
    activeTo: "Sep 30, 2024",
  },
  {
    id: "dc-2",
    code: "SPRING50",
    label: "Spring Special",
    type: "Percentage",
    discount: 50,
    usageCount: 0,
    usageLimit: null,
    status: "Active",
    activeFrom: "Apr 15, 2024",
    activeTo: "Sep 30, 2024",
  },
  {
    id: "dc-3",
    code: "WELCOME10",
    label: "Welcome Discount",
    type: "Percentage",
    discount: 0,
    usageCount: 98,
    usageLimit: 100,
    status: "Active",
    activeFrom: "Jan 1, 2024",
    activeTo: "Dec 31, 2024",
  },
]

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

export const signUps: SignUp[] = [
  { id: "su-1", title: "New Volunteers", startDate: "Apr 20, 2024", schedule: "Upcoming", groupName: "General Volunteers", status: "Published" },
  { id: "su-2", title: "Bake Sale Volunteers", startDate: "Apr 12, 2024", schedule: "Past", groupName: "Bake Sale Committee", status: "Published" },
  { id: "su-3", title: "Community Cleanup", startDate: "Apr 15, 2024", schedule: "Upcoming", groupName: "Community Aid Team", status: "Published" },
  { id: "su-4", title: "School Fundraiser", startDate: "Apr 10, 2024", schedule: "Past", groupName: "Parent Volunteers", status: "Published" },
]

export const signUpGroups: SignUpGroup[] = [
  { id: "sg-1", name: "General Volunteers", members: 180, signUps: 7, status: "Published" },
  { id: "sg-2", name: "Bake Sale Committee", members: 32, signUps: 2, status: "Published" },
  { id: "sg-3", name: "Community Aid Team", members: 45, signUps: 4, status: "Published" },
  { id: "sg-4", name: "Parent Volunteers", members: 67, signUps: 3, status: "Published" },
  { id: "sg-5", name: "Fundraising Team", members: 25, signUps: 6, status: "Published" },
]

export const signUpMessages: SignUpMessage[] = [
  { id: "sm-1", sentDate: "Apr 15, 2024", subject: "Join us for the Community Cleanup!", type: "Sent" },
  { id: "sm-2", sentDate: "Apr 12, 2024", subject: "Bake sale Volunteer reminder", type: "Sent" },
  { id: "sm-3", sentDate: "Apr 10, 2024", subject: "Spring Gala Volunteers Needed", type: "Sent" },
  { id: "sm-4", sentDate: "Apr 5, 2024", subject: "Thanks for signing up!", type: "Sent" },
]

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

export const bookings: Booking[] = [
  { id: "bk-1", startDate: "Apr 19, 2024", startTime: "10:00 AM", endDate: "Apr 19, 2024", endTime: "11:10 AM", space: "Main Conference Room", title: "Team Meeting", booker: "Jacob Harris", status: "Confirmed" },
  { id: "bk-2", startDate: "Apr 17, 2024", startTime: "8:00 AM", endDate: "Apr 12, 2024", endTime: "8:30 AM", space: "Space One", title: "Client Presentation", booker: "Jacob Harris", status: "Approved" },
  { id: "bk-3", startDate: "Apr 15, 2024", startTime: "9:00 AM", endDate: "Apr 15, 2024", endTime: "9:40 AM", space: "Space One", title: "Interview", booker: "Jacob Harris", status: "Cancelled" },
  { id: "bk-4", startDate: "Apr 19, 2024", startTime: "3:00 AM", endDate: "Apr 19, 2024", endTime: "3:00 PM", space: "Sarah Garcia", title: "Workshop", booker: "Jacob Harris", status: "Rejected" },
  { id: "bk-5", startDate: "Apr 19, 2024", startTime: "9:00 AM", endDate: "Apr 10, 2024", endTime: "11:30 AM", space: "Training Room", title: "Research Discussion", booker: "Jacob Harris", status: "Confirmed" },
]

export const bookingCalendar: BookingCalendarEntry[] = [
  { id: "bc-1", timeSlot: "9:30 - 10:30A", eventDate: "Apr 20, 2024 10:00 AM", space: "Team Meeting", location: "Client Meeting", status: "Confirmed", booker: "Jacob Harris" },
  { id: "bc-2", timeSlot: "9:30 - 10:30A", eventDate: "Apr 29, 2024 8:00 AM", space: "Interview", location: "Interview", status: "Confirmed", booker: "Emily Wang" },
  { id: "bc-3", timeSlot: "10:00 - 11:30A", eventDate: "Apr 15, 2024 9:00 AM", space: "Workshop", location: "Research Discussion", status: "Confirmed", booker: "Megan Nelson" },
  { id: "bc-4", timeSlot: "10:00 - 11:30A", eventDate: "Apr 29, 2024 11:30 AM", space: "Research Discussion", location: "Content Creation", status: "Confirmed", booker: "David Park" },
]

export interface CalendarGridEvent {
  id: string
  title: string
  space: string
  startHour: number
  durationHours: number
  color: string
  booker: string
}

export const calendarSpaces = [
  "Swimming Pool",
  "Conference Room 1 - Library",
  "Conference Room 2",
  "Main Hall",
  "Main Building - Lobby",
  "Banquet Hall",
  "Youth Lounge",
  "Training Room",
]

export const calendarGridEvents: CalendarGridEvent[] = [
  { id: "cge-1", title: "Team Meeting", space: "Main Conference Room", startHour: 9, durationHours: 1.5, color: "bg-blue-200 text-blue-800 border-blue-300", booker: "Jacob Harris" },
  { id: "cge-2", title: "Client Presentation", space: "Space Two", startHour: 10, durationHours: 1, color: "bg-emerald-200 text-emerald-800 border-emerald-300", booker: "Emily Wang" },
  { id: "cge-3", title: "Interview", space: "Space One", startHour: 9, durationHours: 1, color: "bg-amber-200 text-amber-800 border-amber-300", booker: "Sarah Garcia" },
  { id: "cge-4", title: "Workshop", space: "Banquet Hall", startHour: 11, durationHours: 2, color: "bg-rose-200 text-rose-800 border-rose-300", booker: "Megan Nelson" },
  { id: "cge-5", title: "Research Discussion", space: "Training Room", startHour: 8, durationHours: 1.5, color: "bg-violet-200 text-violet-800 border-violet-300", booker: "David Park" },
  { id: "cge-6", title: "Yoga Session", space: "Youth Lounge", startHour: 10, durationHours: 1, color: "bg-pink-200 text-pink-800 border-pink-300", booker: "Emily Wang" },
]

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

export const calendarListEvents: CalendarListEvent[] = [
  { id: "cl-1", startTime: "7:00 AM", endTime: "4:00 PM", duration: "9h", recurring: true, space: "Space Two", booker: "Alex Tremo", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-2", startTime: "9:00 AM", endTime: "11:00 AM", duration: "2h", recurring: true, space: "Main Conference Room", booker: "Sarah Connor", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-3", startTime: "10:00 AM", endTime: "2:00 PM", duration: "4h", recurring: false, space: "Banquet Hall, Youth Lounge", booker: "(Walk-in)", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-4", startTime: "10:30 AM", endTime: "4:30 PM", duration: "6h", recurring: true, space: "Training Room", booker: "(Walk-in)", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-5", startTime: "2:00 PM", endTime: "4:00 PM", duration: "2h", recurring: true, space: "Youth Lounge", booker: "(Walk-in)", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-6", startTime: "6:00 PM", endTime: "10:00 PM", duration: "4h", recurring: false, space: "Banquet Hall", booker: "(Walk-in)", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-7", startTime: "8:00 PM", endTime: "10:00 PM", duration: "2h", recurring: true, space: "Space One", booker: "James Lee", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-8", startTime: "8:00 PM", endTime: "10:00 PM", duration: "2h", recurring: true, space: "Youth Lounge", booker: "James Lee", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-9", startTime: "10:00 PM", endTime: "12:00 AM", duration: "2h", recurring: false, space: "Space One", booker: "Sarah Connor", date: "2026-03-07", dateLabel: "SATURDAY, MARCH 7, 2026" },
  { id: "cl-10", startTime: "6:30 AM", endTime: "9:00 AM", duration: "2h 30m", recurring: false, space: "Space One", booker: "(Walk-in)", date: "2026-03-08", dateLabel: "SUNDAY, MARCH 8, 2026" },
  { id: "cl-11", startTime: "8:30 AM", endTime: "10:00 AM", duration: "1h 30m", recurring: false, space: "Main Conference Room", booker: "Megan Nelson", date: "2026-03-08", dateLabel: "SUNDAY, MARCH 8, 2026" },
]

export const bookingSpaces: BookingSpace[] = [
  { id: "bs-1", name: "Space One", capacity: 160, hours: "8:00 AM - 10:00 PM", peakFlat: "$500", peakHourly: "$75/hr", nonPeakFlat: "$350", nonPeakHourly: "$50/hr", tag: "Internal", status: "Published" },
  { id: "bs-2", name: "Main Conference Room", capacity: 32, hours: "9:00 AM - 6:00 PM", peakFlat: "$800", peakHourly: "$120/hr", nonPeakFlat: "$550", nonPeakHourly: "$80/hr", tag: "Internal", status: "Published" },
  { id: "bs-3", name: "Space Two", capacity: 45, hours: "8:00 AM - 10:00 PM", peakFlat: "$400", peakHourly: "$60/hr", nonPeakFlat: "$275", nonPeakHourly: "$40/hr", tag: "External", status: "Published" },
  { id: "bs-4", name: "Banquet Hall", capacity: 200, hours: "7:00 AM - 11:00 PM", peakFlat: "$2,000", peakHourly: "$250/hr", nonPeakFlat: "$1,200", nonPeakHourly: "$150/hr", tag: "External", status: "Published" },
  { id: "bs-5", name: "Training Room", capacity: 25, hours: "9:00 AM - 5:00 PM", peakFlat: "$300", peakHourly: "$45/hr", nonPeakFlat: "$200", nonPeakHourly: "$30/hr", tag: "Internal", status: "Draft" },
  { id: "bs-6", name: "Youth Lounge", capacity: 50, hours: "10:00 AM - 8:00 PM", peakFlat: "$375", peakHourly: "$55/hr", nonPeakFlat: "$225", nonPeakHourly: "$35/hr", tag: "Internal", status: "Published" },
]

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

export const applicationTypes: ApplicationType[] = [
  {
    id: "app-type-1",
    name: "Vendor",
    description: "Apply to become a vendor and sell products or services at our events and facilities.",
    icon: "Store",
    requirements: [
      "Valid business license",
      "Proof of liability insurance",
      "Product/service description",
    ],
    isActive: true,
    createdAt: "2024-01-01",
    formType: "vendor",
  },
  {
    id: "app-type-2",
    name: "Volunteer",
    description: "Join our volunteer team and help make a difference in our community.",
    icon: "Heart",
    requirements: [
      "Background check consent",
      "Availability schedule",
      "Areas of interest",
    ],
    isActive: true,
    createdAt: "2024-01-01",
  },
  {
    id: "app-type-3",
    name: "Childcare Provider",
    description: "Apply to become a babysitter or childcare provider offering hourly-based care services.",
    icon: "Baby",
    requirements: [
      "CPR and First Aid certification",
      "Background check consent",
      "References from previous childcare experience",
      "Valid identification",
    ],
    isActive: true,
    createdAt: "2024-02-15",
    formType: "childcare",
  },
  {
    id: "app-type-4",
    name: "Committee Member",
    description: "Serve on one of our community committees and help shape our programs.",
    icon: "Users",
    requirements: [
      "Statement of interest",
      "Relevant experience",
      "Time commitment acknowledgment",
    ],
    isActive: true,
    createdAt: "2024-03-01",
  },
  {
    id: "app-type-5",
    name: "Financial Aid",
    description: "Apply for financial assistance for programs, memberships, or services.",
    icon: "HandCoins",
    requirements: [
      "Proof of income or financial need",
      "Completed financial aid form",
      "Program or service details",
    ],
    isActive: true,
    createdAt: "2024-03-15",
  },
  {
    id: "app-type-6",
    name: "Employment",
    description: "Apply for employment opportunities within our organization.",
    icon: "Briefcase",
    requirements: [
      "Resume or CV",
      "Cover letter",
      "References",
      "Work authorization documentation",
    ],
    isActive: true,
    createdAt: "2024-04-01",
  },
]

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

export const customerEnrollments: CustomerEnrollment[] = [
  {
    id: "enr-1",
    name: "Family Membership",
    type: "Membership",
    description: "Annual family membership with access to all facilities and programs.",
    status: "Active",
    startDate: "Jan 1, 2026",
    endDate: "Dec 31, 2026",
    billingCycle: "Monthly",
    amount: 75.00,
    nextPaymentDate: "Mar 1, 2026",
    totalPaid: 150.00,
    payments: [
      { id: "pay-0", date: "Feb 20, 2026", amount: 75.00, status: "Failed", method: "Visa ending in 4242", transactionId: "#TXN001235", failureReason: "Card expired" },
      { id: "pay-1", date: "Feb 1, 2026", amount: 75.00, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN001234" },
      { id: "pay-2", date: "Jan 1, 2026", amount: 75.00, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN001122" },
    ],
  },
  {
    id: "enr-2",
    name: "Youth Swimming Lessons",
    type: "Program",
    description: "8-week swimming program for children ages 6-12.",
    status: "Active",
    startDate: "Feb 15, 2026",
    endDate: "Apr 12, 2026",
    billingCycle: "One-time",
    amount: 180.00,
    totalPaid: 180.00,
    payments: [
      { id: "pay-3", date: "Feb 10, 2026", amount: 180.00, status: "Paid", method: "Mastercard ending in 5555", transactionId: "#TXN001456" },
    ],
  },
  {
    id: "enr-3",
    name: "After School Care",
    type: "Service",
    description: "Daily after school care program from 3 PM to 6 PM.",
    status: "Past Due",
    startDate: "Sep 1, 2025",
    endDate: "Jun 15, 2026",
    billingCycle: "Monthly",
    amount: 250.00,
    nextPaymentDate: "Mar 1, 2026",
    totalPaid: 1250.00,
    payments: [
      { id: "pay-4a", date: "Feb 15, 2026", amount: 250.00, status: "Failed", method: "Visa ending in 4242", transactionId: "#TXN001790", failureReason: "Card declined - insufficient funds" },
      { id: "pay-4", date: "Feb 1, 2026", amount: 250.00, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN001789" },
      { id: "pay-5", date: "Jan 1, 2026", amount: 250.00, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN001678" },
      { id: "pay-6", date: "Dec 1, 2025", amount: 250.00, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN001567" },
    ],
  },
  {
    id: "enr-4",
    name: "Yoga Class - Beginner",
    type: "Class",
    description: "Weekly beginner yoga class, Tuesdays and Thursdays.",
    status: "Inactive",
    startDate: "Oct 1, 2025",
    endDate: "Dec 31, 2025",
    billingCycle: "Monthly",
    amount: 45.00,
    totalPaid: 135.00,
    payments: [
      { id: "pay-10", date: "Dec 1, 2025", amount: 45.00, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN000987" },
      { id: "pay-11", date: "Nov 1, 2025", amount: 45.00, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN000876" },
      { id: "pay-12", date: "Oct 1, 2025", amount: 45.00, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN000765" },
    ],
  },
  {
    id: "enr-5",
    name: "Newsletter Subscription",
    type: "Subscription",
    description: "Premium newsletter with exclusive content and early event access.",
    status: "Active",
    startDate: "Jan 15, 2026",
    billingCycle: "Annually",
    amount: 29.99,
    nextPaymentDate: "Jan 15, 2027",
    totalPaid: 29.99,
    payments: [
      { id: "pay-13", date: "Jan 15, 2026", amount: 29.99, status: "Paid", method: "Visa ending in 4242", transactionId: "#TXN002001" },
    ],
  },
  {
    id: "enr-6",
    name: "Summer Camp 2025",
    type: "Program",
    description: "2-week summer camp program for ages 8-14.",
    status: "Completed",
    startDate: "Jul 10, 2025",
    endDate: "Jul 24, 2025",
    billingCycle: "One-time",
    amount: 450.00,
    totalPaid: 450.00,
    payments: [
      { id: "pay-14", date: "Jun 1, 2025", amount: 225.00, status: "Paid", method: "Mastercard ending in 5555", transactionId: "#TXN000123" },
      { id: "pay-15", date: "Jul 1, 2025", amount: 225.00, status: "Paid", method: "Mastercard ending in 5555", transactionId: "#TXN000234" },
    ],
  },
]

// ==========================================
// Overview Stats
// ==========================================

export const overviewStats = {
  nextEventIn: { days: 12, eventName: "Spring Gala", date: "Mar 2, 2026" },
  publishedEvents: { count: 8, label: "Active" },
  ordersReceived: 143,
  ticketsIssued: 287,
  totalRevenue: { amount: 12840.0, label: "Gross" },
}

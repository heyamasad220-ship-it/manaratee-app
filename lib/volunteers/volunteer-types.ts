export type VolunteerStatus = "active" | "inactive" | "pending"
export type VolunteerSignUpStatus = "confirmed" | "pending" | "completed" | "cancelled"
export type VolunteerPerformance = "excellent" | "good" | "average" | "poor"

export type VolunteerRow = {
  id: string
  organization_id: string
  contact_id?: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  status: VolunteerStatus
  join_date: string
  skills: string[]
  availability: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export type VolunteerSignUpRow = {
  id: string
  organization_id: string
  volunteer_id: string
  event_name: string
  event_date: string | null
  role: string | null
  hours_logged: number
  status: VolunteerSignUpStatus
  created_at: string
  updated_at: string
}

export type VolunteerHistoryRow = {
  id: string
  organization_id: string
  volunteer_id: string
  event_name: string
  event_date: string | null
  role: string | null
  hours_worked: number
  performance: VolunteerPerformance
  notes: string | null
  created_at: string
  updated_at: string
}

export type VolunteerSignUp = {
  id: string
  eventName: string
  date: string
  role: string
  hoursLogged: number
  status: "Confirmed" | "Pending" | "Completed" | "Cancelled"
}

export type VolunteerHistory = {
  id: string
  eventName: string
  date: string
  role: string
  hoursWorked: number
  performance: "Excellent" | "Good" | "Average" | "Poor"
  notes?: string
}

export type Volunteer = {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  status: "Active" | "Inactive" | "Pending"
  joinDate: string
  joinDateRaw: string
  totalHours: number
  eventsVolunteered: number
  skills: string[]
  availability: string[]
  notes: string
  signUps: VolunteerSignUp[]
  history: VolunteerHistory[]
}

export type VolunteerFormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  status: VolunteerStatus
  join_date: string
  skills: string
  availability: string
  notes: string
}

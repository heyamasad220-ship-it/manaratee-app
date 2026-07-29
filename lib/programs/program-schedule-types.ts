export type ProgramScheduleDayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"

export interface ProgramScheduleItem {
  id: string
  organization_id: string
  program_id: string
  offering_id: string

  title: string

  day_of_week: ProgramScheduleDayOfWeek

  start_time: string
  end_time: string

  location: string | null
  /** Optional bookable venue for shared facility calendar / conflict checks. */
  venue_id?: string | null

  instructor_name: string | null
  capacity: number | null

  color: string

  is_recurring: boolean
  recurring_group_id: string | null

  created_at: string
  updated_at: string
}

export const PROGRAM_SCHEDULE_DAYS: ProgramScheduleDayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

export const PROGRAM_SCHEDULE_DAY_LABELS: Record<
  ProgramScheduleDayOfWeek,
  string
> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

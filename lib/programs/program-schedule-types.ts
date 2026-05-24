export interface ProgramScheduleItem {
  id: string
  organization_id: string
  program_id: string

  title: string

  day_of_week:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday"

  start_time: string
  end_time: string

  location: string | null

  instructor_name: string | null
  capacity: number | null

  color: string

  is_recurring: boolean
recurring_group_id: string | null

  created_at: string
  updated_at: string
}
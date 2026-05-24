import type { ProgramStatus } from "./program-status"

export interface Program {
  id: string

  organization_id: string

  name: string
  description: string | null

  department_id: string | null

  start_date: string | null
  end_date: string | null

  enrollment_open_date: string | null
  enrollment_close_date: string | null

  age_groups: string[]
  grade_levels: string[]

  gender: string | null

  capacity: number
  enrolled: number
  waitlist: number

  status: ProgramStatus

  created_at: string
  updated_at: string
}
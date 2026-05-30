export type ProgramSessionStatus =
  | "active"
  | "paused"
  | "archived"

export interface ProgramSession {
  id: string

  organization_id: string
  program_id: string

  name: string
  description: string | null

  start_date: string | null
  end_date: string | null

  registration_open_date: string | null
  registration_close_date: string | null

  capacity: number
  enrolled: number
  waitlist: number

  enable_waitlist: boolean
  waitlist_capacity: number | null

  price: number

  status: ProgramSessionStatus

  sort_order: number

  created_at: string
  updated_at: string
}
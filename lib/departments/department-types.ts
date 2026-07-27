export interface Department {
  id: string
  organization_id: string
  name: string
  description: string | null
  color: string
  flyer_url?: string | null
  created_at: string
  updated_at: string
}
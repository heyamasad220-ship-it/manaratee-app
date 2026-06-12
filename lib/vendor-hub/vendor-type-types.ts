export interface VendorHubVendorType {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  default_fee: number | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

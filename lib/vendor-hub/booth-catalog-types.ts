export type BoothAttributeCategory = "utility" | "placement" | "environment"

export interface VendorHubBoothAttribute {
  id: string
  organization_id: string
  name: string
  slug: string
  category: BoothAttributeCategory
  description: string | null
  is_active: boolean
  sort_order: number
}

export interface VendorHubBoothSetupTemplate {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  sort_order: number
}

export interface VendorHubBoothSetupTemplateLine {
  id: string
  template_id: string
  line_name: string
  size: string | null
  price: number | null
  color: string | null
  quantity: number
  capacity: number | null
  location: string | null
  description: string | null
  sort_order: number
  attribute_slugs: string[]
}

export interface VendorHubBoothSetupTemplateWithLines extends VendorHubBoothSetupTemplate {
  lines: VendorHubBoothSetupTemplateLine[]
}

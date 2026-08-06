/**
 * Vendor org application field registry.
 *
 * Core identity + business fields stay enabled so Vendor Network / profile keep working.
 * To add or remove questions later: toggle `enabled`, or append a new field definition
 * (then render automatically on the apply form and staff review labels).
 *
 * A staff Settings UI can later persist enabled/order overrides without changing code.
 */

export type VendorApplicationFieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select_vendor_type"
  | "url"

export type VendorApplicationFieldSection =
  | "contact"
  | "business"
  | "social"
  | "offerings"
  | "additional"

export type VendorApplicationFieldDef = {
  key: string
  label: string
  type: VendorApplicationFieldType
  section: VendorApplicationFieldSection
  required: boolean
  enabled: boolean
  /** System fields should not be removed by a future settings UI. */
  core: boolean
  placeholder?: string
  rows?: number
  helpText?: string
}

export const VENDOR_APPLICATION_FIELD_DEFS: VendorApplicationFieldDef[] = [
  {
    key: "first_name",
    label: "First name",
    type: "text",
    section: "contact",
    required: true,
    enabled: true,
    core: true,
  },
  {
    key: "last_name",
    label: "Last name",
    type: "text",
    section: "contact",
    required: true,
    enabled: true,
    core: true,
  },
  {
    key: "email",
    label: "Email address",
    type: "email",
    section: "contact",
    required: true,
    enabled: true,
    core: true,
  },
  {
    key: "phone",
    label: "Phone number",
    type: "tel",
    section: "contact",
    required: true,
    enabled: true,
    core: true,
  },
  {
    key: "business_name",
    label: "Name of business",
    type: "text",
    section: "business",
    required: true,
    enabled: true,
    core: true,
    placeholder: "e.g., Dubai Oud",
  },
  {
    key: "vendor_type_id",
    label: "Type of business",
    type: "select_vendor_type",
    section: "business",
    required: true,
    enabled: true,
    core: true,
    helpText: "Choose the category that best matches what you sell or offer.",
  },
  {
    key: "facebook",
    label: "Facebook",
    type: "url",
    section: "social",
    required: false,
    enabled: true,
    core: false,
    placeholder: "https://facebook.com/…",
  },
  {
    key: "instagram",
    label: "Instagram",
    type: "url",
    section: "social",
    required: false,
    enabled: true,
    core: false,
    placeholder: "@handle or https://instagram.com/…",
  },
  {
    key: "website",
    label: "Website",
    type: "url",
    section: "social",
    required: false,
    enabled: true,
    core: false,
    placeholder: "https://…",
  },
  {
    key: "products_services",
    label: "Products or services",
    type: "textarea",
    section: "offerings",
    required: true,
    enabled: true,
    core: true,
    rows: 4,
    placeholder: "Describe what you sell or offer at bazaars and community events.",
  },
  {
    key: "years_in_business",
    label: "Years in business",
    type: "text",
    section: "additional",
    required: false,
    enabled: true,
    core: false,
    placeholder: "Optional",
  },
  {
    key: "service_area",
    label: "City / service area",
    type: "text",
    section: "additional",
    required: false,
    enabled: true,
    core: false,
    placeholder: "e.g., Dallas–Fort Worth",
  },
  {
    key: "has_liability_insurance",
    label: "Do you carry liability insurance?",
    type: "text",
    section: "additional",
    required: false,
    enabled: true,
    core: false,
    helpText: "Answer Yes or No. Food and beverage vendors may be asked for a certificate later.",
    placeholder: "Yes / No",
  },
  {
    key: "additional_notes",
    label: "Anything else we should know?",
    type: "textarea",
    section: "additional",
    required: false,
    enabled: true,
    core: false,
    rows: 3,
    placeholder: "Optional notes for the review team",
  },
]

export const VENDOR_APPLICATION_SECTION_LABELS: Record<VendorApplicationFieldSection, string> = {
  contact: "Contact information",
  business: "Business",
  social: "Social media & website",
  offerings: "Products & services",
  additional: "Additional details",
}

export function getEnabledVendorApplicationFields() {
  return VENDOR_APPLICATION_FIELD_DEFS.filter((field) => field.enabled)
}

export function getVendorApplicationFieldLabel(key: string) {
  return VENDOR_APPLICATION_FIELD_DEFS.find((field) => field.key === key)?.label ?? key
}

export type VendorApplicationFormValues = {
  first_name: string
  last_name: string
  email: string
  phone: string
  business_name: string
  vendor_type_id: string
  facebook: string
  instagram: string
  website: string
  products_services: string
  years_in_business: string
  service_area: string
  has_liability_insurance: string
  additional_notes: string
}

export function emptyVendorApplicationFormValues(
  defaults?: Partial<VendorApplicationFormValues>
): VendorApplicationFormValues {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    business_name: "",
    vendor_type_id: "",
    facebook: "",
    instagram: "",
    website: "",
    products_services: "",
    years_in_business: "",
    service_area: "",
    has_liability_insurance: "",
    additional_notes: "",
    ...defaults,
  }
}

/** Compose a free-text social blob for existing vendor profile parsers. */
export function composeVendorSocialBlob(values: Pick<
  VendorApplicationFormValues,
  "facebook" | "instagram" | "website"
>) {
  return [
    values.facebook.trim() ? `Facebook: ${values.facebook.trim()}` : null,
    values.instagram.trim() ? `Instagram: ${values.instagram.trim()}` : null,
    values.website.trim() ? `Website: ${values.website.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

/** Build form_data stored on applications (aligned with vendor profile / network). */
export function buildVendorApplicationFormData(
  values: VendorApplicationFormValues,
  vendorTypeName: string | null
) {
  const products = values.products_services.trim()
  const social = composeVendorSocialBlob(values)

  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
    business_name: values.business_name.trim(),
    vendor_type_id: values.vendor_type_id.trim() || null,
    vendor_type_name: vendorTypeName,
    facebook: values.facebook.trim() || null,
    instagram: values.instagram.trim() || null,
    website: values.website.trim() || null,
    social: social || null,
    products_services: products,
    selling: products,
    years_in_business: values.years_in_business.trim() || null,
    service_area: values.service_area.trim() || null,
    has_liability_insurance: values.has_liability_insurance.trim() || null,
    additional_notes: values.additional_notes.trim() || null,
  }
}

const HIDDEN_FORM_DATA_KEYS = new Set(["selling"])

/** Labeled rows for staff application review. */
export function formatVendorApplicationFormDataForReview(
  formData: Record<string, unknown> | null | undefined
) {
  if (!formData || typeof formData !== "object") return []

  const rows: { key: string; label: string; value: string }[] = []
  const seen = new Set<string>()

  for (const field of VENDOR_APPLICATION_FIELD_DEFS) {
    if (!(field.key in formData)) continue
    const raw = formData[field.key]
    if (raw == null || raw === "") continue
    seen.add(field.key)
    rows.push({
      key: field.key,
      label: field.label,
      value: String(raw),
    })
  }

  // Common aliases stored alongside fields
  if (typeof formData.vendor_type_name === "string" && formData.vendor_type_name.trim()) {
    if (!rows.some((row) => row.key === "vendor_type_id")) {
      rows.push({
        key: "vendor_type_name",
        label: "Type of business",
        value: formData.vendor_type_name.trim(),
      })
    } else {
      const typeRow = rows.find((row) => row.key === "vendor_type_id")
      if (typeRow) typeRow.value = formData.vendor_type_name.trim()
    }
  }

  for (const [key, raw] of Object.entries(formData)) {
    if (seen.has(key) || HIDDEN_FORM_DATA_KEYS.has(key)) continue
    if (key === "vendor_type_name" || key === "social") continue
    if (raw == null || raw === "") continue
    if (typeof raw === "object") continue
    rows.push({
      key,
      label: getVendorApplicationFieldLabel(key),
      value: String(raw),
    })
  }

  return rows
}

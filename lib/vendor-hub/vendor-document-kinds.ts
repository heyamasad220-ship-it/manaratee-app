export const VENDOR_DOCUMENT_KINDS = [
  {
    value: "food_license",
    label: "Food license",
  },
  {
    value: "insurance_certificate",
    label: "Insurance certificate",
  },
  {
    value: "sales_tax_permit",
    label: "Sales tax permit",
  },
  {
    value: "other",
    label: "Other",
  },
] as const

export type VendorDocumentKind = (typeof VENDOR_DOCUMENT_KINDS)[number]["value"]

export function isVendorDocumentKind(value: string): value is VendorDocumentKind {
  return VENDOR_DOCUMENT_KINDS.some((kind) => kind.value === value)
}

export function vendorDocumentKindLabel(value: string | null | undefined) {
  const match = VENDOR_DOCUMENT_KINDS.find((kind) => kind.value === value)
  return match?.label ?? "Other"
}

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getParticipationHistory } from "@/lib/vendor-hub/participation-history-queries"
import type { ParticipationHistoryRow } from "@/lib/vendor-hub/participation-history-queries"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"
import {
  vendorDocumentKindLabel,
  type VendorDocumentKind,
} from "@/lib/vendor-hub/vendor-document-kinds"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"

export type VendorProfileDocument = {
  id: string
  fileName: string
  fileUrl: string
  fileType: string | null
  documentKind: VendorDocumentKind | "other"
  documentKindLabel: string
  createdAt: string
}

export type VendorProfileData = {
  contactId: string
  applicationId: string | null
  contactName: string
  businessName: string
  primaryContactName: string
  email: string
  phone: string
  social: string | null
  productsServices: string | null
  vendorTypeId: string | null
  vendorTypeName: string | null
  status: string
  vendorTypes: VendorHubVendorType[]
  participation: ParticipationHistoryRow[]
  documents: VendorProfileDocument[]
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {}
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function getVendorProfile(
  contactId: string
): Promise<VendorProfileData | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const supabase = await createClient()

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, status")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (contactError || !contact) {
    console.error("getVendorProfile contact:", contactError?.message)
    return null
  }

  const { data: application } = await supabase
    .from("applications")
    .select("id, form_data, status")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
    .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const formData = asRecord(application?.form_data)
  const contactName = (contact.full_name as string | null)?.trim() || "Unnamed contact"
  const businessName =
    stringField(formData, "business_name") || contactName
  const primaryContactName = contactName || businessName
  const vendorTypeId = stringField(formData, "vendor_type_id")

  const vendorTypes = await getVendorHubVendorTypes({ activeOnly: false })
  const vendorTypeName =
    vendorTypes.find((type) => type.id === vendorTypeId)?.name || null

  const participation = await getParticipationHistory(contactId)

  let documents: VendorProfileDocument[] = []
  if (application?.id) {
    const { data: docs, error: docsError } = await supabase
      .from("application_documents")
      .select("id, file_name, file_url, file_type, document_kind, created_at")
      .eq("organization_id", organizationId)
      .eq("application_id", application.id)
      .order("created_at", { ascending: false })

    if (docsError) {
      // document_kind column may be missing until 230 is applied
      const { data: fallbackDocs } = await supabase
        .from("application_documents")
        .select("id, file_name, file_url, file_type, created_at")
        .eq("organization_id", organizationId)
        .eq("application_id", application.id)
        .order("created_at", { ascending: false })

      documents = (fallbackDocs || []).map((doc) => ({
        id: doc.id as string,
        fileName: doc.file_name as string,
        fileUrl: doc.file_url as string,
        fileType: (doc.file_type as string | null) ?? null,
        documentKind: "other" as const,
        documentKindLabel: vendorDocumentKindLabel("other"),
        createdAt: doc.created_at as string,
      }))
    } else {
      documents = (docs || []).map((doc) => {
        const kind = ((doc.document_kind as string | null) || "other") as
          | VendorDocumentKind
          | "other"
        return {
          id: doc.id as string,
          fileName: doc.file_name as string,
          fileUrl: doc.file_url as string,
          fileType: (doc.file_type as string | null) ?? null,
          documentKind: kind,
          documentKindLabel: vendorDocumentKindLabel(kind),
          createdAt: doc.created_at as string,
        }
      })
    }
  }

  return {
    contactId,
    applicationId: (application?.id as string | null) ?? null,
    contactName,
    businessName,
    primaryContactName,
    email: (contact.email as string | null) || "",
    phone: (contact.phone as string | null) || "",
    social: stringField(formData, "social"),
    productsServices:
      stringField(formData, "products_services") || stringField(formData, "selling"),
    vendorTypeId,
    vendorTypeName,
    status: (contact.status as string | null) || "active",
    vendorTypes: vendorTypes.filter((type) => type.is_active || type.id === vendorTypeId),
    participation,
    documents,
  }
}

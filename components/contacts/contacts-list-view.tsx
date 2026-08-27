"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { addContactWithRoles } from "@/lib/contacts/contact-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import {
  fetchAllTeamMembershipsForFilter,
  fetchHrTeamPositions,
  fetchHrTeams,
  type HrTeamMembership,
} from "@/lib/hr/hr-team-actions"
import {
  type ContactRecordType,
  type ContactRoleLabel,
  type ContactRoleValue,
  type ContactStatus,
  ROLE_COLORS,
  ROLE_ICONS,
  ROLE_OPTIONS,
  ROLE_VALUE_TO_LABEL,
  STATUS_COLORS,
  STATUS_OPTIONS,
  filterContactRoles,
  mapRoleValue,
  mapStatus,
  statusToDbValue,
  MEMBERSHIP_DERIVED_ROLE,
  normalizeContactRecordType,
} from "@/lib/contacts/contact-constants"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PhoneText } from "@/components/ui/phone-text"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ListPagination } from "@/components/ui/list-pagination"
import {
  TableColumnHeaderFilter,
  TableColumnHeaderSort,
} from "@/components/ui/table-column-header-filter"
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/ui/list-pagination"
import { cn } from "@/lib/utils"
import { CreateVendorDialog } from "@/components/vendor-hub/events/create-vendor-dialog"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"
import {
  isVendorInactiveByLastActivity,
  vendorLastActivityAt,
} from "@/lib/vendor-hub/vendor-activity"
import {
  Search,
  Plus,
  Phone,
  Building2,
  User,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Filter,
} from "lucide-react"

const LAST_ACTIVITY_SORT_OPTIONS = [
  { value: "desc", label: "Newest first" },
  { value: "asc", label: "Oldest first" },
] as const

type LastActivitySort = (typeof LAST_ACTIVITY_SORT_OPTIONS)[number]["value"]

export interface ContactListItem {
  id: string
  name: string
  email: string
  phone: string
  recordType: ContactRecordType
  roles: ContactRoleLabel[]
  roleValues: ContactRoleValue[]
  status: ContactStatus
  createdAt: string
  lastActivity?: string
  businessName?: string | null
  vendorType?: string | null
  vendorTypeId?: string | null
}

export type ContactsListViewProps = {
  /** When set, only contacts with this role are shown (HR views). */
  requiredRole?: ContactRoleValue
  /** Lock record type filter (People / Organizations pages). */
  lockedRecordType?: ContactRecordType
  /** Pre-selected roles when opening Add Contact. */
  defaultAddRoles?: ContactRoleValue[]
  /** Show summary stat cards. */
  showStats?: boolean
  /** Hide role filter controls when locked to a single role. */
  hideRoleFilter?: boolean
  /** Hide record type filter when locked. */
  hideRecordTypeFilter?: boolean
  /** Vendor Network columns: contact+phone, business name, vendor type; no roles/record type/actions. */
  vendorNetworkLayout?: boolean
  /** Optional content beside the Add Contact button. */
  headerAction?: ReactNode
  emptyMessage?: string
  /** Show team / team position / membership status filters (HR Members). */
  showTeamFilters?: boolean
  /** Omit outer padding when embedded inside another page tab. */
  embedded?: boolean
  /** Only fetch contacts when the user searches (avoids loading the full list on open). */
  searchToLoad?: boolean
}

function parseVendorCategoryFromNotes(notes: string | null | undefined) {
  if (!notes) return null
  const match = String(notes).match(/(?:^|\n)category=([^\n]*)/i)
  const value = match?.[1]?.trim()
  return value || null
}

async function loadVendorTypesByContact(
  supabase: ReturnType<typeof createClient>,
  contactIds: string[]
) {
  const typeByContact = new Map<string, string>()
  if (contactIds.length === 0) return typeByContact

  const chunkSize = 200
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("vendor_hub_payments")
      .select("contact_id, payment_date, notes")
      .in("contact_id", chunk)
      .order("payment_date", { ascending: false })

    if (error) {
      console.error(
        "loadVendorTypesByContact payments:",
        error.message || error.code || error
      )
    } else {
      for (const row of data || []) {
        const contactId = row.contact_id as string | null
        if (!contactId || typeByContact.has(contactId)) continue
        const category = parseVendorCategoryFromNotes(row.notes as string | null)
        if (category) typeByContact.set(contactId, category)
      }
    }

    const missing = chunk.filter((id) => !typeByContact.has(id))
    if (missing.length === 0) continue

    const { data: participants, error: participantError } = await supabase
      .from("vendor_hub_participant_status")
      .select("contact_id, updated_at, notes")
      .in("contact_id", missing)
      .order("updated_at", { ascending: false })

    if (participantError) {
      console.error(
        "loadVendorTypesByContact participants:",
        participantError.message || participantError.code || participantError
      )
      continue
    }

    for (const row of participants || []) {
      const contactId = row.contact_id as string | null
      if (!contactId || typeByContact.has(contactId)) continue
      const category = parseVendorCategoryFromNotes(row.notes as string | null)
      if (category) typeByContact.set(contactId, category)
    }
  }

  return typeByContact
}

function businessNameFromFormData(formData: unknown) {
  if (!formData || typeof formData !== "object") return null
  const value = (formData as Record<string, unknown>).business_name
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

async function loadVendorBusinessNamesByContact(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactIds: string[]
) {
  const nameByContact = new Map<string, string>()
  const vendorTypeIdByContact = new Map<string, string>()
  if (contactIds.length === 0) {
    return { nameByContact, vendorTypeIdByContact }
  }

  const chunkSize = 200
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("applications")
      .select("contact_id, form_data, created_at")
      .eq("organization_id", orgId)
      .eq("application_type", "vendor")
      .in("contact_id", chunk)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(
        "loadVendorBusinessNamesByContact:",
        error.message || error.code || error
      )
      continue
    }

    for (const row of data || []) {
      const contactId = row.contact_id as string | null
      if (!contactId) continue
      if (!nameByContact.has(contactId)) {
        const businessName = businessNameFromFormData(row.form_data)
        if (businessName) nameByContact.set(contactId, businessName)
      }
      if (!vendorTypeIdByContact.has(contactId)) {
        const formData =
          row.form_data && typeof row.form_data === "object"
            ? (row.form_data as Record<string, unknown>)
            : null
        const typeId =
          typeof formData?.vendor_type_id === "string"
            ? formData.vendor_type_id.trim()
            : ""
        if (typeId) vendorTypeIdByContact.set(contactId, typeId)
      }
    }

    const missing = chunk.filter((id) => !nameByContact.has(id))
    if (missing.length === 0) continue

    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, full_name, email")
      .in("id", missing)

    for (const contact of contacts || []) {
      const fallback = (contact.full_name || contact.email || "").trim()
      if (fallback) nameByContact.set(contact.id, fallback)
    }
  }

  return { nameByContact, vendorTypeIdByContact }
}

function getInitials(name: string) {
  const fallback = name?.trim() || "?"
  return fallback
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString()
}

function RoleCheckboxGroup({
  selected,
  onChange,
  idPrefix,
}: {
  selected: ContactRoleValue[]
  onChange: (roles: ContactRoleValue[]) => void
  idPrefix: string
}) {
  function toggleRole(role: ContactRoleValue, checked: boolean) {
    if (checked) {
      onChange(Array.from(new Set([...selected, role])))
      return
    }
    onChange(selected.filter((item) => item !== role))
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ROLE_OPTIONS.map((role) => (
        <label
          key={role.value}
          htmlFor={`${idPrefix}-${role.value}`}
          className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <Checkbox
            id={`${idPrefix}-${role.value}`}
            checked={selected.includes(role.value)}
            onCheckedChange={(checked) => toggleRole(role.value, checked === true)}
          />
          {role.label}
        </label>
      ))}
    </div>
  )
}

export function ContactsListView({
  requiredRole,
  lockedRecordType,
  defaultAddRoles = [],
  showStats = true,
  hideRoleFilter = false,
  hideRecordTypeFilter = false,
  vendorNetworkLayout = false,
  headerAction,
  emptyMessage,
  showTeamFilters = false,
  embedded = false,
  searchToLoad = false,
}: ContactsListViewProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [contacts, setContacts] = useState<ContactListItem[]>([])
  const [loading, setLoading] = useState(!searchToLoad)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    people: 0,
    organizations: 0,
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilters, setRoleFilters] = useState<ContactRoleValue[]>(
    requiredRole ? [requiredRole] : []
  )
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">(
    vendorNetworkLayout ? "Active" : "all"
  )
  const [recordTypeFilter, setRecordTypeFilter] = useState<ContactRecordType | "all">(
    lockedRecordType || "all"
  )
  const [teamFilter, setTeamFilter] = useState("all")
  const [teamPositionFilter, setTeamPositionFilter] = useState("all")
  const [membershipStatusFilter, setMembershipStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [listPage, setListPage] = useState(1)
  const [listPageSize, setListPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [listTotal, setListTotal] = useState(0)

  // Vendor Network column filters (debounced text filters)
  const [contactColumnFilterInput, setContactColumnFilterInput] = useState("")
  const [contactColumnFilter, setContactColumnFilter] = useState("")
  const [businessNameFilterInput, setBusinessNameFilterInput] = useState("")
  const [businessNameFilter, setBusinessNameFilter] = useState("")
  const [vendorTypeFilter, setVendorTypeFilter] = useState<string>("all")
  const [vendorTypeOptions, setVendorTypeOptions] = useState<VendorHubVendorType[]>([])
  const [lastActivitySort, setLastActivitySort] = useState<LastActivitySort>("desc")

  const [teamOptions, setTeamOptions] = useState<{ id: string; name: string }[]>([])
  const [teamPositionOptions, setTeamPositionOptions] = useState<{ id: string; name: string }[]>([])
  const [teamMemberships, setTeamMemberships] = useState<HrTeamMembership[]>([])

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null)

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactType, setContactType] = useState<ContactRecordType>(
    lockedRecordType || "individual"
  )
  const [contactRoles, setContactRoles] = useState<ContactRoleValue[]>(defaultAddRoles)
  const [contactNotes, setContactNotes] = useState("")

  const hideMembershipRole = Boolean(requiredRole)

  const mapContactRows = useCallback(
    (rows: any[]): ContactListItem[] => {
      return rows.map((c: any) => {
        const roleValues = filterContactRoles(
          Array.from(
            new Set((c.contact_roles || []).map((r: any) => r.role as string).filter(Boolean))
          )
        )
        const visibleRoleValues = hideMembershipRole
          ? roleValues.filter((role) => role !== MEMBERSHIP_DERIVED_ROLE)
          : roleValues
        const roles = visibleRoleValues
          .map((value) => mapRoleValue(value))
          .filter(Boolean) as ContactRoleLabel[]
        const recordType = normalizeContactRecordType(c.contact_type)

        return {
          id: c.id,
          name: c.full_name || c.email || c.phone || "Unnamed Contact",
          email: c.email || "",
          phone: c.phone || "",
          recordType,
          roleValues,
          roles,
          status: mapStatus(c.status),
          createdAt: c.created_at,
          lastActivity: c.last_activity_at || c.updated_at || c.created_at,
          businessName: null,
          vendorType: null,
          vendorTypeId: null,
        }
      })
    },
    [hideMembershipRole]
  )

  const loadSummaryStats = useCallback(async () => {
    if (!showStats || !searchToLoad) return

    const orgId = await getCurrentOrganizationId()
    if (!orgId) {
      setSummaryStats({ total: 0, people: 0, organizations: 0 })
      return
    }

    const [totalRes, peopleRes, organizationsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("contact_type", "individual"),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("contact_type", "organization"),
    ])

    setSummaryStats({
      total: totalRes.count ?? 0,
      people: peopleRes.count ?? 0,
      organizations: organizationsRes.count ?? 0,
    })
  }, [searchToLoad, showStats, supabase])

  const loadVendorNetworkPage = useCallback(async () => {
    const role = requiredRole || "vendor"
    const contactFields =
      "id, full_name, email, phone, contact_type, status, created_at, updated_at, last_activity_at, contact_roles!inner(role)"

    setLoading(true)
    setErrorMessage("")

    const orgId = await getCurrentOrganizationId()
    if (!orgId) {
      setContacts([])
      setListTotal(0)
      setLoading(false)
      return
    }

    const trimmedContact = contactColumnFilter.trim()
    const trimmedBusiness = businessNameFilter.trim().toLowerCase()

    let allRows: any[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
      let query = supabase
        .from("contacts")
        .select(contactFields)
        .eq("organization_id", orgId)
        .eq("contact_roles.role", role)
        .order("full_name", { ascending: true })
        .range(from, from + pageSize - 1)

      // Status Active/Inactive is applied from Last Activity after load (not DB status alone).

      if (trimmedContact) {
        const escapedSearch = trimmedContact.replace(/[%_\\,]/g, "\\$&")
        const pattern = `%${escapedSearch}%`
        query = query.or(
          `full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
        )
      }

      const { data, error } = await query

      if (error) {
        console.error(
          "Error loading vendor network contacts:",
          error.message || error.code || error
        )
        setContacts([])
        setListTotal(0)
        setErrorMessage(error.message || "Could not load vendors.")
        setLoading(false)
        return
      }

      allRows = [...allRows, ...(data || [])]
      if (!data || data.length < pageSize) break
      from += pageSize
    }

    const now = Date.now()
    const mapped = mapContactRows(allRows).map((contact, index) => {
      const raw = allRows[index]
      const lastActivity = vendorLastActivityAt({
        last_activity_at: raw?.last_activity_at,
        created_at: raw?.created_at,
      })
      const inactive = isVendorInactiveByLastActivity(lastActivity, now)
      return {
        ...contact,
        lastActivity: lastActivity || contact.createdAt,
        status: (inactive ? "Inactive" : "Active") as ContactStatus,
      }
    })

    const contactIds = mapped.map((c) => c.id)
    const [boothTypeByContact, businessMeta] = await Promise.all([
      loadVendorTypesByContact(supabase, contactIds),
      loadVendorBusinessNamesByContact(supabase, orgId, contactIds),
    ])

    const catalogTypeIds = [...businessMeta.vendorTypeIdByContact.values()]
    const catalogNameById = new Map<string, string>()
    if (catalogTypeIds.length > 0) {
      const { data: catalogTypes } = await supabase
        .from("vendor_hub_vendor_types")
        .select("id, name")
        .in("id", catalogTypeIds)
      for (const type of catalogTypes || []) {
        catalogNameById.set(type.id as string, type.name as string)
      }
    }

    let enriched = mapped.map((c) => {
      const catalogTypeId = businessMeta.vendorTypeIdByContact.get(c.id) || null
      const catalogTypeName = catalogTypeId
        ? catalogNameById.get(catalogTypeId) || null
        : null
      return {
        ...c,
        vendorTypeId: catalogTypeId,
        vendorType: catalogTypeName || boothTypeByContact.get(c.id) || null,
        businessName: businessMeta.nameByContact.get(c.id) || c.name || null,
      }
    })

    if (statusFilter === "Active") {
      enriched = enriched.filter((c) => c.status === "Active")
    } else if (statusFilter === "Inactive") {
      enriched = enriched.filter((c) => c.status === "Inactive")
    }

    if (trimmedBusiness) {
      enriched = enriched.filter((c) =>
        (c.businessName || "").toLowerCase().includes(trimmedBusiness)
      )
    }

    if (vendorTypeFilter !== "all") {
      if (vendorTypeFilter === "__none__") {
        enriched = enriched.filter((c) => !c.vendorTypeId && !c.vendorType)
      } else {
        enriched = enriched.filter(
          (c) =>
            c.vendorTypeId === vendorTypeFilter ||
            c.vendorType === vendorTypeFilter
        )
      }
    }

    enriched = [...enriched].sort((a, b) => {
      const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
      const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
      const safeA = Number.isFinite(aTime) ? aTime : 0
      const safeB = Number.isFinite(bTime) ? bTime : 0
      if (safeA === safeB) {
        return a.name.localeCompare(b.name)
      }
      return lastActivitySort === "asc" ? safeA - safeB : safeB - safeA
    })

    setListTotal(enriched.length)

    const start = (Math.max(1, listPage) - 1) * Math.max(1, listPageSize)
    const pageRows = enriched.slice(start, start + Math.max(1, listPageSize))
    setContacts(pageRows)
    setLoading(false)
  }, [
    businessNameFilter,
    contactColumnFilter,
    lastActivitySort,
    listPage,
    listPageSize,
    mapContactRows,
    requiredRole,
    statusFilter,
    supabase,
    vendorTypeFilter,
  ])

  const loadContacts = useCallback(
    async (search?: string) => {
      if (vendorNetworkLayout) {
        return
      }

      const contactFields =
        "id, full_name, email, phone, contact_type, status, created_at, updated_at, last_activity_at, contact_roles(role)"

      const trimmedSearch = search?.trim() || ""

      if (searchToLoad && !trimmedSearch) {
        setContacts([])
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage("")

      const orgId = await getCurrentOrganizationId()
      if (!orgId) {
        setContacts([])
        setLoading(false)
        return
      }

      const finalizeContacts = async (rows: any[]) => {
        setContacts(mapContactRows(rows))
      }

      if (searchToLoad) {
        const escapedSearch = trimmedSearch.replace(/[%_\\,]/g, "\\$&")
        const pattern = `%${escapedSearch}%`

        const { data, error } = await supabase
          .from("contacts")
          .select(contactFields)
          .eq("organization_id", orgId)
          .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
          .order("full_name", { ascending: true })
          .limit(100)

        if (error) {
          console.error(
            "Error searching contacts:",
            error.message || error.code || error
          )
          setContacts([])
          setErrorMessage(error.message || "Could not search contacts.")
          setLoading(false)
          return
        }

        await finalizeContacts(data || [])
        setLoading(false)
        return
      }

      let allRows: any[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from("contacts")
          .select(contactFields)
          .eq("organization_id", orgId)
          .order("full_name", { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) {
          console.error(
            "Error loading contacts:",
            error.message || error.code || error
          )
          setContacts([])
          setErrorMessage(error.message || "Could not load contacts.")
          setLoading(false)
          return
        }

        allRows = [...allRows, ...(data || [])]
        if (!data || data.length < pageSize) break
        from += pageSize
      }

      await finalizeContacts(allRows)
      setLoading(false)
    },
    [mapContactRows, searchToLoad, supabase, vendorNetworkLayout]
  )

  useEffect(() => {
    if (vendorNetworkLayout) return
    if (searchToLoad) {
      void loadSummaryStats()
      return
    }

    void loadContacts()
  }, [loadContacts, loadSummaryStats, searchToLoad, vendorNetworkLayout])

  useEffect(() => {
    if (!vendorNetworkLayout) return
    setListPage(1)
  }, [
    contactColumnFilter,
    businessNameFilter,
    vendorTypeFilter,
    statusFilter,
    lastActivitySort,
    vendorNetworkLayout,
  ])

  useEffect(() => {
    if (!vendorNetworkLayout) return
    void loadVendorNetworkPage()
  }, [
    vendorNetworkLayout,
    loadVendorNetworkPage,
    contactColumnFilter,
    businessNameFilter,
    vendorTypeFilter,
    listPage,
    listPageSize,
    statusFilter,
    lastActivitySort,
  ])

  useEffect(() => {
    if (!vendorNetworkLayout) return
    const timer = window.setTimeout(
      () => setContactColumnFilter(contactColumnFilterInput.trim()),
      350
    )
    return () => window.clearTimeout(timer)
  }, [contactColumnFilterInput, vendorNetworkLayout])

  useEffect(() => {
    if (!vendorNetworkLayout) return
    const timer = window.setTimeout(
      () => setBusinessNameFilter(businessNameFilterInput.trim()),
      350
    )
    return () => window.clearTimeout(timer)
  }, [businessNameFilterInput, vendorNetworkLayout])

  useEffect(() => {
    if (!vendorNetworkLayout) return

    async function loadVendorTypes() {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) {
        setVendorTypeOptions([])
        return
      }
      const { data } = await supabase
        .from("vendor_hub_vendor_types")
        .select("*")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
      setVendorTypeOptions((data || []) as VendorHubVendorType[])
    }

    void loadVendorTypes()
  }, [supabase, vendorNetworkLayout])

  useEffect(() => {
    if (vendorNetworkLayout || !searchToLoad) return

    const trimmedSearch = searchQuery.trim()
    if (!trimmedSearch) {
      setContacts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = window.setTimeout(() => {
      void loadContacts(trimmedSearch)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [loadContacts, searchQuery, searchToLoad, vendorNetworkLayout])

  useEffect(() => {
    if (!showTeamFilters) return

    async function loadTeamFilterData() {
      try {
        const [teams, positions, memberships] = await Promise.all([
          fetchHrTeams({ includeInactive: false }),
          fetchHrTeamPositions(false),
          fetchAllTeamMembershipsForFilter(),
        ])
        setTeamOptions(teams.map((team) => ({ id: team.id, name: team.name })))
        setTeamPositionOptions(positions.map((position) => ({ id: position.id, name: position.name })))
        setTeamMemberships(memberships)
      } catch (error) {
        console.error("Team filter data error:", error)
        setTeamOptions([])
        setTeamPositionOptions([])
        setTeamMemberships([])
      }
    }

    void loadTeamFilterData()
  }, [showTeamFilters])

  const membershipsByContact = useMemo(() => {
    const map = new Map<string, HrTeamMembership[]>()
    for (const membership of teamMemberships) {
      const existing = map.get(membership.contact_id) || []
      existing.push(membership)
      map.set(membership.contact_id, existing)
    }
    return map
  }, [teamMemberships])

  const filteredContacts = useMemo(() => {
    if (vendorNetworkLayout) {
      return contacts
    }

    const search = searchQuery.trim().toLowerCase()

    return contacts.filter((contact) => {
      const matchesSearch =
        !search ||
        contact.name.toLowerCase().includes(search) ||
        contact.email.toLowerCase().includes(search) ||
        contact.phone.includes(search)

      const activeRoleFilters = requiredRole ? [requiredRole] : roleFilters
      const matchesRole =
        activeRoleFilters.length === 0 ||
        activeRoleFilters.every((role) => contact.roleValues.includes(role))

      const matchesStatus = statusFilter === "all" || contact.status === statusFilter
      const effectiveRecordType = lockedRecordType || recordTypeFilter
      const matchesRecordType =
        effectiveRecordType === "all" || contact.recordType === effectiveRecordType

      let matchesTeamFilters = true
      if (showTeamFilters) {
        const contactMemberships = membershipsByContact.get(contact.id) || []
        const relevantMemberships = contactMemberships.filter((membership) => {
          const matchesTeam = teamFilter === "all" || membership.team_id === teamFilter
          const matchesPosition =
            teamPositionFilter === "all" || membership.team_position_id === teamPositionFilter
          const matchesMembershipStatus =
            membershipStatusFilter === "all" || membership.status === membershipStatusFilter
          return matchesTeam && matchesPosition && matchesMembershipStatus
        })

        const hasTeamConstraints =
          teamFilter !== "all" || teamPositionFilter !== "all" || membershipStatusFilter !== "all"

        matchesTeamFilters = hasTeamConstraints ? relevantMemberships.length > 0 : true
      }

      return matchesSearch && matchesRole && matchesStatus && matchesRecordType && matchesTeamFilters
    })
  }, [
    contacts,
    searchQuery,
    roleFilters,
    requiredRole,
    statusFilter,
    recordTypeFilter,
    lockedRecordType,
    showTeamFilters,
    teamFilter,
    teamPositionFilter,
    membershipStatusFilter,
    membershipsByContact,
    vendorNetworkLayout,
  ])

  const stats = useMemo(() => {
    if (searchToLoad) return summaryStats

    return {
      total: contacts.length,
      people: contacts.filter((c) => c.recordType === "individual").length,
      organizations: contacts.filter((c) => c.recordType === "organization").length,
    }
  }, [contacts, searchToLoad, summaryStats])

  function resetAddForm() {
    setContactName("")
    setContactEmail("")
    setContactPhone("")
    setContactType(lockedRecordType || "individual")
    setContactRoles(defaultAddRoles)
    setContactNotes("")
  }

  function openDeleteDialog(contact: ContactListItem) {
    setSelectedContact(contact)
    setShowDeleteDialog(true)
  }

  async function handleAddContact() {
    const cleanName = contactName.trim()
    if (!cleanName) {
      alert("Contact name is required")
      return
    }
    setSaving(true)
    try {
      const result = await addContactWithRoles({
        fullName: cleanName,
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        contactType: contactType,
        notes: contactNotes.trim() || undefined,
        roles: contactRoles,
      })

      resetAddForm()
      setShowAddDialog(false)

      if (vendorNetworkLayout) {
        await loadVendorNetworkPage()
      } else if (searchToLoad) {
        if (searchQuery.trim()) {
          await loadContacts(searchQuery.trim())
        }
        if (showStats) {
          await loadSummaryStats()
        }
      } else {
        await loadContacts()
      }

      if (result.created) {
        alert("Contact added")
      } else {
        alert("Contact already exists. The selected roles were added if missing.")
      }
    } catch (error: any) {
      alert(error?.message || "Could not add contact")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteContact() {
    if (!selectedContact) return

    setSaving(true)

    const { error: notesError } = await supabase
      .from("contact_notes")
      .delete()
      .eq("contact_id", selectedContact.id)

    if (notesError) {
      alert(notesError.message || "Could not delete contact notes")
      setSaving(false)
      return
    }

    const { error: rolesError } = await supabase
      .from("contact_roles")
      .delete()
      .eq("contact_id", selectedContact.id)

    if (rolesError) {
      alert(rolesError.message || "Could not delete contact roles")
      setSaving(false)
      return
    }

    const { error: contactError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", selectedContact.id)

    if (contactError) {
      alert(contactError.message || "Could not delete contact")
      setSaving(false)
      return
    }

    setShowDeleteDialog(false)
    setSelectedContact(null)

    if (searchToLoad) {
      if (searchQuery.trim()) {
        await loadContacts(searchQuery.trim())
      }
      if (showStats) {
        await loadSummaryStats()
      }
    } else {
      await loadContacts()
    }

    setSaving(false)
  }

  const roleFilterLabel =
    roleFilters.length === 0
      ? "All roles"
      : roleFilters.map((role) => ROLE_VALUE_TO_LABEL[role]).join(", ")

  const statCards = [
    { label: "Total", value: stats.total, icon: User },
    { label: "People", value: stats.people, icon: User },
    { label: "Organizations", value: stats.organizations, icon: Building2 },
  ]

  return (
    <div className={embedded ? "flex flex-col gap-6" : "flex flex-col gap-6 p-6"}>
      {showStats && (
        <StatCardsRow>
          {statCards.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              layout="compact"
            />
          ))}
        </StatCardsRow>
      )}

      <div className="flex flex-col gap-3">
        {!vendorNetworkLayout && (
          <div className="relative w-full sm:max-w-md lg:max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                searchToLoad
                  ? "Search contacts by name, email, or phone..."
                  : "Search by name, email, or phone..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!vendorNetworkLayout && !hideRoleFilter && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 sm:w-[200px]">
                  <Filter className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{roleFilterLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="start">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Filter by role</p>
                  <RoleCheckboxGroup
                    idPrefix="filter"
                    selected={roleFilters}
                    onChange={setRoleFilters}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setRoleFilters([])}
                  >
                    Clear role filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {!vendorNetworkLayout && !hideRecordTypeFilter && !lockedRecordType && (
            <Select
              value={recordTypeFilter}
              onValueChange={(v) => setRecordTypeFilter(v as ContactRecordType | "all")}
            >
              <SelectTrigger className="h-9 shrink-0 sm:w-[165px]">
                <SelectValue placeholder="Record type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="individual">People</SelectItem>
                <SelectItem value="organization">Organizations</SelectItem>
              </SelectContent>
            </Select>
          )}

          {!vendorNetworkLayout && (
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as ContactStatus | "all")
              }}
            >
              <SelectTrigger className="h-9 shrink-0 sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.label}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {headerAction}
          <Button
            size="sm"
            className={vendorNetworkLayout ? "ml-auto shrink-0" : "shrink-0"}
            onClick={() => {
              if (vendorNetworkLayout) {
                setShowAddDialog(true)
                return
              }
              resetAddForm()
              setShowAddDialog(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {vendorNetworkLayout ? "Add Vendor" : "Add Contact"}
          </Button>

          {!vendorNetworkLayout && showTeamFilters && (
            <>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-9 shrink-0 sm:w-[180px]">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teamOptions.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={teamPositionFilter} onValueChange={setTeamPositionFilter}>
                <SelectTrigger className="h-9 shrink-0 sm:w-[180px]">
                  <SelectValue placeholder="Team Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  {teamPositionOptions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={membershipStatusFilter}
                onValueChange={(value) =>
                  setMembershipStatusFilter(value as "all" | "active" | "inactive")
                }
              >
                <SelectTrigger className="h-9 shrink-0 sm:w-[180px]">
                  <SelectValue placeholder="Membership Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Memberships</SelectItem>
                  <SelectItem value="active">Active Membership</SelectItem>
                  <SelectItem value="inactive">Inactive Membership</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {vendorNetworkLayout ? (
                    <TableColumnHeaderFilter
                      label="Contact"
                      active={Boolean(contactColumnFilter)}
                    >
                      {({ close }) => (
                        <div className="space-y-2">
                          <Input
                            placeholder="Filter by name, email, or phone..."
                            value={contactColumnFilterInput}
                            onChange={(event) =>
                              setContactColumnFilterInput(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setContactColumnFilter(contactColumnFilterInput.trim())
                                close()
                              }
                            }}
                          />
                          {contactColumnFilter ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setContactColumnFilterInput("")
                                setContactColumnFilter("")
                                close()
                              }}
                            >
                              Clear
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </TableColumnHeaderFilter>
                  ) : (
                    "Contact"
                  )}
                </TableHead>
                {vendorNetworkLayout ? (
                  <>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Business Name"
                        active={Boolean(businessNameFilter)}
                      >
                        {({ close }) => (
                          <div className="space-y-2">
                            <Input
                              placeholder="Filter by business name..."
                              value={businessNameFilterInput}
                              onChange={(event) =>
                                setBusinessNameFilterInput(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  setBusinessNameFilter(businessNameFilterInput.trim())
                                  close()
                                }
                              }}
                            />
                            {businessNameFilter ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setBusinessNameFilterInput("")
                                  setBusinessNameFilter("")
                                  close()
                                }}
                              >
                                Clear
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Vendor Type"
                        active={vendorTypeFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={vendorTypeFilter}
                            onValueChange={(value) => {
                              setVendorTypeFilter(value)
                              close()
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All types" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All types</SelectItem>
                              <SelectItem value="__none__">No type</SelectItem>
                              {vendorTypeOptions
                                .filter((type) => type.is_active)
                                .map((type) => (
                                  <SelectItem key={type.id} value={type.id}>
                                    {type.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Roles</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Record Type</TableHead>
                  </>
                )}
                <TableHead>
                  {vendorNetworkLayout ? (
                    <TableColumnHeaderFilter
                      label="Status"
                      active={statusFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={statusFilter}
                          onValueChange={(value) => {
                            setStatusFilter(value as ContactStatus | "all")
                            close()
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status.value} value={status.label}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  ) : (
                    "Status"
                  )}
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  {vendorNetworkLayout ? (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Last Activity</span>
                      <TableColumnHeaderSort
                        label="Last Activity"
                        value={lastActivitySort}
                        active
                        options={[...LAST_ACTIVITY_SORT_OPTIONS]}
                        onChange={(value) =>
                          setLastActivitySort(value as LastActivitySort)
                        }
                      />
                    </div>
                  ) : (
                    "Last Activity"
                  )}
                </TableHead>
                {!vendorNetworkLayout && (
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={vendorNetworkLayout ? 5 : 7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading contacts...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={vendorNetworkLayout ? 5 : 7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {searchToLoad && !searchQuery.trim()
                      ? "Start typing to search for contacts."
                      : vendorNetworkLayout
                        ? statusFilter === "Active"
                          ? "No active vendors match. Use the Status filter to view inactive vendors or All Status."
                          : statusFilter === "Inactive"
                            ? "No inactive vendors match."
                            : contactColumnFilter ||
                                businessNameFilter ||
                                vendorTypeFilter !== "all"
                              ? "No vendors match the current filters."
                              : emptyMessage || "No vendors yet."
                        : emptyMessage ||
                          (searchQuery.trim()
                            ? "No contacts found."
                            : "No contacts match the current filters.")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    onClick={() =>
                      router.push(
                        vendorNetworkLayout
                          ? VENDOR_HUB_ROUTES.network.vendor(contact.id)
                          : contactProfileHref(contact.id)
                      )
                    }
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-0.5">
                          {vendorNetworkLayout ? (
                            <span className="font-semibold text-foreground">
                              {contact.name}
                            </span>
                          ) : (
                            <Link
                              href={contactProfileHref(contact.id)}
                              className="font-medium text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {contact.name}
                            </Link>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {contact.email || "-"}
                          </span>
                          {vendorNetworkLayout && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <PhoneText value={contact.phone} empty="-" />
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {vendorNetworkLayout ? (
                      <>
                        <TableCell className="text-sm">
                          {contact.businessName || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {contact.vendorType || "—"}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {contact.roles.length === 0 ? (
                              <span className="text-sm text-muted-foreground">—</span>
                            ) : (
                              contact.roles.map((role) => {
                                const RoleIcon = ROLE_ICONS[role]
                                return (
                                  <Badge
                                    key={role}
                                    variant="secondary"
                                    className={cn("gap-1", ROLE_COLORS[role])}
                                  >
                                    <RoleIcon className="h-3 w-3" />
                                    {role}
                                  </Badge>
                                )
                              })
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <PhoneText value={contact.phone} empty="-" />
                          </div>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline">
                            {contact.recordType === "organization" ? "Organization" : "Person"}
                          </Badge>
                        </TableCell>
                      </>
                    )}

                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[contact.status]}>
                        {contact.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDate(contact.lastActivity || contact.createdAt)}
                    </TableCell>

                    {!vendorNetworkLayout && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={contactProfileHref(contact.id, { edit: true })}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit profile
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(contact)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {vendorNetworkLayout && listTotal > 0 ? (
        <ListPagination
          page={listPage}
          pageSize={listPageSize}
          total={listTotal}
          entryLabel="vendors"
          onPageChange={setListPage}
          onPageSizeChange={(next) => {
            setListPageSize(next)
            setListPage(1)
          }}
        />
      ) : null}

      <Dialog
        open={!vendorNetworkLayout && showAddDialog}
        onOpenChange={(open) => {
          if (!vendorNetworkLayout) setShowAddDialog(open)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Create a person or organization with basic details. Roles sync automatically from
              donations and other activity; add manual roles on the contact profile if needed.
              Existing contacts are matched by email, phone, or name — never duplicated.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">
                {contactType === "organization" ? "Organization Name" : "Full Name"}
              </Label>
              <Input
                id="name"
                placeholder={
                  contactType === "organization" ? "Enter organization name" : "Enter full name"
                }
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>

            {!lockedRecordType && (
              <div className="flex flex-col gap-2">
                <Label>Record Type</Label>
                <Select
                  value={contactType}
                  onValueChange={(value) => setContactType(value as ContactRecordType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Person</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes..."
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddForm()
                setShowAddDialog(false)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleAddContact} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {vendorNetworkLayout ? (
        <CreateVendorDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          title="Add Vendor"
          vendorTypes={vendorTypeOptions}
          onCreated={() => {
            void loadVendorNetworkPage()
          }}
        />
      ) : null}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              This permanently deletes this contact, their roles, and their contact notes. HR
              extension records may remain until cleaned up separately.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold">{selectedContact?.name || "this contact"}</span>?
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setSelectedContact(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

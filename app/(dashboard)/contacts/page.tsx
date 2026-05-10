"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Search,
  Plus,
  Phone,
  Users,
  Heart,
  Store,
  Wrench,
  Calendar,
  Building2,
  User,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"

type ContactRole = "Customer" | "Volunteer" | "Vendor" | "Service Provider" | "Donor"
type ContactStatus = "Active" | "Inactive" | "VIP" | "Pending" | "Major Donor"
type ContactRecordType = "individual" | "organization"
type RoleFilter = ContactRole | "all"
type StatusFilter = ContactStatus | "all"

interface Contact {
  id: string
  name: string
  email: string
  phone: string
  recordType: ContactRecordType
  roles: ContactRole[]
  status: ContactStatus
  createdAt: string
  lastActivity?: string
}

const roleOptions: { label: ContactRole; value: string }[] = [
  { label: "Customer", value: "customer" },
  { label: "Volunteer", value: "volunteer" },
  { label: "Vendor", value: "vendor" },
  { label: "Service Provider", value: "service_provider" },
  { label: "Donor", value: "donor" },
]

const roleColors: Record<ContactRole, string> = {
  Customer: "bg-blue-100 text-blue-700",
  Volunteer: "bg-emerald-100 text-emerald-700",
  Vendor: "bg-amber-100 text-amber-700",
  "Service Provider": "bg-purple-100 text-purple-700",
  Donor: "bg-rose-100 text-rose-700",
}

const roleIcons: Record<ContactRole, typeof Users> = {
  Customer: Users,
  Volunteer: Calendar,
  Vendor: Store,
  "Service Provider": Wrench,
  Donor: Heart,
}

const statusColors: Record<ContactStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-700",
  VIP: "bg-yellow-100 text-yellow-700",
  Pending: "bg-orange-100 text-orange-700",
  "Major Donor": "bg-purple-100 text-purple-700",
}

const statusOptions: { label: ContactStatus; value: string }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "VIP", value: "vip" },
  { label: "Pending", value: "pending" },
  { label: "Major Donor", value: "major_donor" },
]

function mapRole(role?: string): ContactRole {
  if (role === "donor") return "Donor"
  if (role === "volunteer") return "Volunteer"
  if (role === "vendor") return "Vendor"
  if (role === "service_provider") return "Service Provider"
  return "Customer"
}

function mapStatus(status?: string | null): ContactStatus {
  const cleanStatus = (status || "active").toLowerCase()

  if (cleanStatus === "inactive") return "Inactive"
  if (cleanStatus === "pending") return "Pending"
  if (cleanStatus === "vip") return "VIP"
  if (cleanStatus === "major_donor" || cleanStatus === "major donor") return "Major Donor"

  return "Active"
}

function statusToDbValue(status: ContactStatus) {
  if (status === "Major Donor") return "major_donor"
  return status.toLowerCase()
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

export default function ContactsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [recordTypeFilter, setRecordTypeFilter] = useState<ContactRecordType | "all">("all")

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactType, setContactType] = useState<ContactRecordType>("individual")
  const [contactRole, setContactRole] = useState("customer")
  const [contactNotes, setContactNotes] = useState("")

  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editContactType, setEditContactType] = useState<ContactRecordType>("individual")
  const [editStatus, setEditStatus] = useState("active")

  const loadContacts = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")

    const orgId = await getCurrentOrganizationId()

    if (!orgId) {
      setContacts([])
      setLoading(false)
      return
    }

    let allRows: any[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          id,
          full_name,
          email,
          phone,
          contact_type,
          status,
          created_at,
          contact_roles(role)
        `)
        .eq("organization_id", orgId)
        .order("full_name", { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) {
        console.error("Error loading contacts:", error)
        setContacts([])
        setErrorMessage(error.message || "Could not load contacts.")
        setLoading(false)
        return
      }

      allRows = [...allRows, ...(data || [])]

      if (!data || data.length < pageSize) break
      from += pageSize
    }

    const mappedContacts: Contact[] = allRows.map((c: any) => {
      const roles = (c.contact_roles || []).map((r: any) => mapRole(r.role))
      const uniqueRoles = Array.from(new Set(roles)) as ContactRole[]
      const recordType: ContactRecordType =
        c.contact_type === "organization" ? "organization" : "individual"

      return {
        id: c.id,
        name: c.full_name || c.email || c.phone || "Unnamed Contact",
        email: c.email || "",
        phone: c.phone || "",
        recordType,
        roles: uniqueRoles.length > 0 ? uniqueRoles : ["Customer"],
        status: mapStatus(c.status),
        createdAt: c.created_at,
        lastActivity: c.created_at,
      }
    })

    setContacts(mappedContacts)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  const filteredContacts = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()

    if (!search) {
      return []
    }

    return contacts.filter((contact) => {
      const matchesSearch =
        contact.name.toLowerCase().includes(search) ||
        contact.email.toLowerCase().includes(search) ||
        contact.phone.includes(search)

      const matchesRole = roleFilter === "all" || contact.roles.includes(roleFilter)
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter
      const matchesRecordType =
        recordTypeFilter === "all" || contact.recordType === recordTypeFilter

      return matchesSearch && matchesRole && matchesStatus && matchesRecordType
    })
  }, [contacts, searchQuery, roleFilter, statusFilter, recordTypeFilter])

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      people: contacts.filter((c) => c.recordType === "individual").length,
      organizations: contacts.filter((c) => c.recordType === "organization").length,
      customers: contacts.filter((c) => c.roles.includes("Customer")).length,
      volunteers: contacts.filter((c) => c.roles.includes("Volunteer")).length,
      vendors: contacts.filter((c) => c.roles.includes("Vendor")).length,
      serviceProviders: contacts.filter((c) => c.roles.includes("Service Provider")).length,
      donors: contacts.filter((c) => c.roles.includes("Donor")).length,
    }
  }, [contacts])

  function resetAddForm() {
    setContactName("")
    setContactEmail("")
    setContactPhone("")
    setContactType("individual")
    setContactRole("customer")
    setContactNotes("")
  }

  function openEditDialog(contact: Contact) {
    setSelectedContact(contact)
    setEditName(contact.name)
    setEditEmail(contact.email)
    setEditPhone(contact.phone)
    setEditContactType(contact.recordType)
    setEditStatus(statusToDbValue(contact.status))
    setShowEditDialog(true)
  }

  function openDeleteDialog(contact: Contact) {
    setSelectedContact(contact)
    setShowDeleteDialog(true)
  }

  async function handleAddContact() {
    const orgId = await getCurrentOrganizationId()

    if (!orgId) {
      alert("No organization selected")
      return
    }

    const cleanName = contactName.trim()
    const cleanEmail = contactEmail.trim().toLowerCase()
    const cleanPhone = contactPhone.replace(/[^\d]/g, "")

    if (!cleanName) {
      alert("Contact name is required")
      return
    }

    setSaving(true)

    let existingContact: any = null

    if (cleanEmail || cleanPhone) {
      const duplicateChecks = [
        cleanEmail ? `email.eq.${cleanEmail}` : "",
        cleanPhone ? `phone.eq.${cleanPhone}` : "",
      ]
        .filter(Boolean)
        .join(",")

      const { data: matches, error: matchError } = await supabase
        .from("contacts")
        .select("id, full_name, email, phone")
        .eq("organization_id", orgId)
        .or(duplicateChecks)

      if (matchError) {
        console.error("Error checking existing contacts:", matchError)
        alert(matchError.message)
        setSaving(false)
        return
      }

      existingContact = matches?.[0] || null
    }

    if (!existingContact) {
      const { data: nameMatches, error: nameMatchError } = await supabase
        .from("contacts")
        .select("id, full_name, email, phone")
        .eq("organization_id", orgId)
        .ilike("full_name", cleanName)

      if (nameMatchError) {
        console.error("Error checking contact name:", nameMatchError)
        alert(nameMatchError.message)
        setSaving(false)
        return
      }

      existingContact = nameMatches?.[0] || null
    }

    let contactId = existingContact?.id

    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          full_name: cleanName,
          email: cleanEmail || null,
          phone: cleanPhone || null,
          contact_type: contactType,
          notes: contactNotes.trim() || null,
          status: "active",
        })
        .select("id")
        .single()

      if (contactError || !newContact) {
        console.error("Error adding contact:", contactError)
        alert(contactError?.message || "Could not add contact")
        setSaving(false)
        return
      }

      contactId = newContact.id
    }

    const { data: existingRole, error: existingRoleError } = await supabase
      .from("contact_roles")
      .select("id")
      .eq("contact_id", contactId)
      .eq("role", contactRole)
      .maybeSingle()

    if (existingRoleError) {
      console.error("Error checking contact role:", existingRoleError)
      alert(existingRoleError.message || "Could not check contact role")
      setSaving(false)
      return
    }

    if (!existingRole) {
      const { error: roleError } = await supabase.from("contact_roles").insert({
        organization_id: orgId,
        contact_id: contactId,
        role: contactRole,
      })

      if (roleError) {
        console.error("Error adding contact role:", roleError)
        alert(roleError.message || "Could not add contact role")
        setSaving(false)
        return
      }
    }

    resetAddForm()
    setShowAddDialog(false)
    await loadContacts()
    setSaving(false)

    if (existingContact) {
      alert("Contact already exists. The selected role was added if it was missing.")
    } else {
      alert("Contact added")
    }
  }

  async function handleUpdateContact() {
    if (!selectedContact) return

    const cleanName = editName.trim()
    const cleanEmail = editEmail.trim().toLowerCase()
    const cleanPhone = editPhone.replace(/[^\d]/g, "")

    if (!cleanName) {
      alert("Contact name is required")
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from("contacts")
      .update({
        full_name: cleanName,
        email: cleanEmail || null,
        phone: cleanPhone || null,
        contact_type: editContactType,
        status: editStatus,
      })
      .eq("id", selectedContact.id)

    if (error) {
      console.error("Error updating contact:", error)
      alert(error.message || "Could not update contact")
      setSaving(false)
      return
    }

    setShowEditDialog(false)
    setSelectedContact(null)
    await loadContacts()
    setSaving(false)
  }

  async function handleDeleteContact() {
    if (!selectedContact) return

    setSaving(true)

    const { error: notesError } = await supabase
      .from("contact_notes")
      .delete()
      .eq("contact_id", selectedContact.id)

    if (notesError) {
      console.error("Error deleting contact notes:", notesError)
      alert(notesError.message || "Could not delete contact notes")
      setSaving(false)
      return
    }

    const { error: rolesError } = await supabase
      .from("contact_roles")
      .delete()
      .eq("contact_id", selectedContact.id)

    if (rolesError) {
      console.error("Error deleting contact roles:", rolesError)
      alert(rolesError.message || "Could not delete contact roles")
      setSaving(false)
      return
    }

    const { error: contactError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", selectedContact.id)

    if (contactError) {
      console.error("Error deleting contact:", contactError)
      alert(contactError.message || "Could not delete contact")
      setSaving(false)
      return
    }

    setShowDeleteDialog(false)
    setSelectedContact(null)
    await loadContacts()
    setSaving(false)
  }

  const roleFilterButtons: { label: string; value: RoleFilter; count: number }[] = [
    { label: "All", value: "all", count: stats.total },
    { label: "Customers", value: "Customer", count: stats.customers },
    { label: "Volunteers", value: "Volunteer", count: stats.volunteers },
    { label: "Vendors", value: "Vendor", count: stats.vendors },
    { label: "Service Providers", value: "Service Provider", count: stats.serviceProviders },
    { label: "Donors", value: "Donor", count: stats.donors },
  ]

  return (
    <>
      <Header title="Contacts" />

      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-sky-600" />
                <div className="text-2xl font-bold">{stats.people}</div>
              </div>
              <div className="text-sm text-muted-foreground">People</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600" />
                <div className="text-2xl font-bold">{stats.organizations}</div>
              </div>
              <div className="text-sm text-muted-foreground">Organizations</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div className="text-2xl font-bold">{stats.customers}</div>
              </div>
              <div className="text-sm text-muted-foreground">Customers</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <div className="text-2xl font-bold">{stats.volunteers}</div>
              </div>
              <div className="text-sm text-muted-foreground">Volunteers</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-amber-600" />
                <div className="text-2xl font-bold">{stats.vendors}</div>
              </div>
              <div className="text-sm text-muted-foreground">Vendors</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-purple-600" />
                <div className="text-2xl font-bold">{stats.serviceProviders}</div>
              </div>
              <div className="text-sm text-muted-foreground">Providers</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-600" />
                <div className="text-2xl font-bold">{stats.donors}</div>
              </div>
              <div className="text-sm text-muted-foreground">Donors</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          {roleFilterButtons.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant={roleFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter(filter.value)}
            >
              {filter.label}
              <span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">
                {filter.count}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Start typing to search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Customer">Customers</SelectItem>
                <SelectItem value="Volunteer">Volunteers</SelectItem>
                <SelectItem value="Vendor">Vendors</SelectItem>
                <SelectItem value="Service Provider">Service Providers</SelectItem>
                <SelectItem value="Donor">Donors</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={recordTypeFilter}
              onValueChange={(v) => setRecordTypeFilter(v as ContactRecordType | "all")}
            >
              <SelectTrigger className="w-full sm:w-[165px]">
                <SelectValue placeholder="Record type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="individual">Individuals</SelectItem>
                <SelectItem value="organization">Organizations</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Major Donor">Major Donor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
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
                  <TableHead>Contact</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Record Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Last Activity</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading contacts...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {searchQuery.trim()
                        ? "No contacts found."
                        : "Start typing to search contacts."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{contact.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {contact.email || "-"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.roles.map((role) => {
                            const RoleIcon = roleIcons[role]

                            return (
                              <Badge
                                key={role}
                                variant="secondary"
                                className={cn("gap-1", roleColors[role])}
                              >
                                <RoleIcon className="h-3 w-3" />
                                {role}
                              </Badge>
                            )
                          })}
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone || "-"}
                        </div>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline">
                          {contact.recordType === "organization" ? "Organization" : "Individual"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className={statusColors[contact.status]}>
                          {contact.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatDate(contact.lastActivity || contact.createdAt)}
                      </TableCell>

                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(contact)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Add one contact and assign the correct role. Existing contacts will not be duplicated.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Contact Role</Label>
                <Select value={contactRole} onValueChange={setContactRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the contact's basic information.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">
                {editContactType === "organization" ? "Organization Name" : "Full Name"}
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Record Type</Label>
                <Select
                  value={editContactType}
                  onValueChange={(value) => setEditContactType(value as ContactRecordType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false)
                setSelectedContact(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateContact} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              This permanently deletes this contact, their roles, and their contact notes. This cannot be undone.
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
    </>
  )
}

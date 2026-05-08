"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Search,
  Plus,
  Phone,
  Mail,
  Users,
  Heart,
  Store,
  Wrench,
  Calendar,
} from "lucide-react"

type ContactType = "Customer" | "Volunteer" | "Vendor" | "Service Provider" | "Donor"
type ContactStatus = "Active" | "Inactive" | "VIP" | "Pending" | "Major Donor"

interface Contact {
  id: string
  name: string
  email: string
  phone: string
  type: ContactType
  roles: ContactType[]
  status: ContactStatus
  organization?: string
  createdAt: string
  lastActivity?: string
}

const typeColors: Record<ContactType, string> = {
  Customer: "bg-blue-100 text-blue-700",
  Volunteer: "bg-emerald-100 text-emerald-700",
  Vendor: "bg-amber-100 text-amber-700",
  "Service Provider": "bg-purple-100 text-purple-700",
  Donor: "bg-rose-100 text-rose-700",
}

const typeIcons: Record<ContactType, typeof Users> = {
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


export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<ContactType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactOrganization, setContactOrganization] = useState("")
  const [contactType, setContactType] = useState("individual")
  const [contactRole, setContactRole] = useState("customer")
  const [contactNotes, setContactNotes] = useState("")
  const supabase = createClient()
  const [contacts, setContacts] = useState<Contact[]>([])

  async function loadContacts() {
    const orgId = await getCurrentOrganizationId()

    if (!orgId) {
      setContacts([])
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
    return
  }

  allRows = [...allRows, ...(data || [])]

  if (!data || data.length < pageSize) break

  from += pageSize
}

setContacts(
  allRows.map((c: any) => {
        const roles = (c.contact_roles || []).map((r: any) => {
          if (r.role === "donor") return "Donor"
          if (r.role === "volunteer") return "Volunteer"
          if (r.role === "vendor") return "Vendor"
          if (r.role === "service_provider") return "Service Provider"
          return "Customer"
        })

        const uniqueRoles = Array.from(new Set(roles)) as ContactType[]

        return {
          id: c.id,
          name: c.full_name || "",
          email: c.email || "",
          phone: c.phone || "",
          type: uniqueRoles[0] || "Customer",
          roles: uniqueRoles.length > 0 ? uniqueRoles : ["Customer"],
          status:
            c.status === "inactive"
              ? "Inactive"
              : c.status === "pending"
              ? "Pending"
              : "Active",
          organization: c.contact_type === "organization" ? c.full_name : "",
          createdAt: c.created_at,
          lastActivity: c.created_at,
        }
      })
    )
  }

useEffect(() => {
  
  loadContacts()
}, [])
  const filteredContacts = useMemo(() => {

  if (!searchQuery.trim()) return []


    return contacts.filter((contact) => {
      const matchesSearch =
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone.includes(searchQuery)
      const matchesType = typeFilter === "all" || (contact.roles || []).includes(typeFilter)
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter
      return matchesSearch && matchesType && matchesStatus
    })
  }, [searchQuery, typeFilter, statusFilter, contacts])

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      customers: contacts.filter((c) => (c.roles || []).includes("Customer")).length,
volunteers: contacts.filter((c) => (c.roles || []).includes("Volunteer")).length,
vendors: contacts.filter((c) => (c.roles || []).includes("Vendor")).length,
serviceProviders: contacts.filter((c) => (c.roles || []).includes("Service Provider")).length,
donors: contacts.filter((c) => (c.roles || []).includes("Donor")).length,
    }
  }, [contacts])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

 async function handleAddContact() {
  const orgId = await getCurrentOrganizationId()

  if (!orgId) {
    alert("No organization selected")
    return
  }

  if (!contactName.trim()) {
    alert("Contact name is required")
    return
  }

  const cleanEmail = contactEmail.trim()
  const cleanPhone = contactPhone.replace(/[^\d]/g, "")
  const cleanName = contactName.trim()

  let existingContact: any = null

  if (cleanEmail || cleanPhone) {
    const { data: matches, error: matchError } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .or(
        [
          cleanEmail ? `email.eq.${cleanEmail}` : "",
          cleanPhone ? `phone.eq.${cleanPhone}` : "",
        ]
          .filter(Boolean)
          .join(",")
      )

    if (matchError) {
      console.error("Error checking existing contacts:", matchError)
      alert(matchError.message)
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
      return
    }

    contactId = newContact.id
  }

  const { error: roleError } = await supabase
    .from("contact_roles")
    .upsert(
      {
        organization_id: orgId,
        contact_id: contactId,
        role: contactRole,
      },
      { onConflict: "contact_id,role" }
    )

  if (roleError) {
    console.error("Error adding contact role:", roleError)
    alert(roleError.message)
    return
  }

  setContactName("")
  setContactEmail("")
  setContactPhone("")
  setContactOrganization("")
  setContactType("individual")
  setContactRole("customer")
  setContactNotes("")
  setShowAddDialog(false)

  await loadContacts()

if (existingContact) {
  alert("Contact already exists. Added missing role only.")
} else {
  alert("Contact added")
}
}

  return (
    <>
      <Header title="Contacts" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Contacts</div>
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
              <div className="text-sm text-muted-foreground">Service Providers</div>
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

        {/* Filters and Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ContactType | "all")}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Customer">Customers</SelectItem>
                <SelectItem value="Volunteer">Volunteers</SelectItem>
                <SelectItem value="Vendor">Vendors</SelectItem>
                <SelectItem value="Service Provider">Service Providers</SelectItem>
                <SelectItem value="Donor">Donors</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContactStatus | "all")}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by status" />
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

        {/* Contacts Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => {
                  
                  return (
                    <TableRow
  key={contact.id}
  onClick={() => window.location.href = `/contacts/${contact.id}`}
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
                            <span className="text-sm text-muted-foreground">{contact.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
  <div className="flex flex-wrap gap-1">
    {contact.roles.map((role) => {
      const TypeIcon = typeIcons[role]

      return (
        <Badge
          key={role}
          variant="secondary"
          className={cn("gap-1", typeColors[role])}
        >
          <TypeIcon className="h-3 w-3" />
          {role}
        </Badge>
      )
    })}
  </div>
</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {contact.organization || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[contact.status]}>
                          {contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {contact.lastActivity || contact.createdAt}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredContacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {searchQuery.trim()
  ? "No contacts found."
  : "Start typing to search contacts."}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>Add a new contact to your directory.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Full Name</Label>
             <Input
  id="name"
  placeholder="Enter full name"
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
            <div className="flex flex-col gap-2">
  <Label htmlFor="type">Contact Role</Label>

  <Select value={contactRole} onValueChange={setContactRole}>
    <SelectTrigger>
      <SelectValue placeholder="Select role" />
    </SelectTrigger>

    <SelectContent>
      <SelectItem value="customer">Customer</SelectItem>
      <SelectItem value="volunteer">Volunteer</SelectItem>
      <SelectItem value="vendor">Vendor</SelectItem>
      <SelectItem value="service_provider">Service Provider</SelectItem>
      <SelectItem value="donor">Donor</SelectItem>
    </SelectContent>
  </Select>

  <div className="flex flex-col gap-2">
  <Label>Record Type</Label>

  <Select value={contactType} onValueChange={setContactType}>
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
              <Label htmlFor="organization">Organization (Optional)</Label>
              <Input
  id="organization"
  placeholder="Enter organization name"
  value={contactOrganization}
  onChange={(e) => setContactOrganization(e.target.value)}
/>
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
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddContact}>Add Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Building2, Pencil, Save, X, Mail, Phone, MapPin, Calendar, Users } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type OrgStatus = "Active" | "Inactive" | "Pending"

interface Organization {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  dateAdded: string
  status: OrgStatus
  type: string
  notes: string
  website: string
}

const mockOrganizations: Record<string, Organization> = {}

const statusStyles: Record<OrgStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-muted text-muted-foreground",
  Pending: "bg-amber-100 text-amber-700",
}

export default function OrganizationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string
  
  const initialOrg = mockOrganizations[orgId]
  const [isEditing, setIsEditing] = useState(false)
  const [org, setOrg] = useState<Organization | null>(initialOrg || null)

  if (!org) {
    return (
      <>
        <Header title="Organization Not Found" />
        <div className="flex flex-col items-center justify-center gap-4 p-12">
          <Building2 className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Organization not found</h2>
          <p className="text-muted-foreground">The organization you're looking for doesn't exist.</p>
          <Button asChild>
            <Link href="/people/organizations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Organizations
            </Link>
          </Button>
        </div>
      </>
    )
  }

  function handleSave() {
    // In a real app, this would save to the database
    setIsEditing(false)
  }

  function handleCancel() {
    setOrg(initialOrg ?? null)
    setIsEditing(false)
  }

  return (
    <>
      <Header title={org.name} />
      <div className="flex flex-col gap-6 p-6">
        {/* Back link and actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/people/organizations"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Organizations
          </Link>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="mr-1.5 h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="mr-1.5 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit Organization
              </Button>
            )}
          </div>
        </div>

        {/* Organization header */}
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
              <Badge className={statusStyles[org.status]}>{org.status}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{org.type}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Basic information about this organization</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">Organization Name</Label>
                    {isEditing ? (
                      <Input
                        id="name"
                        value={org.name}
                        onChange={(e) => setOrg({ ...org, name: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{org.name}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="type">Organization Type</Label>
                    {isEditing ? (
                      <Select
                        value={org.type}
                        onValueChange={(v) => setOrg({ ...org, type: v })}
                      >
                        <SelectTrigger id="type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Non-Profit">Non-Profit</SelectItem>
                          <SelectItem value="Corporate">Corporate</SelectItem>
                          <SelectItem value="Foundation">Foundation</SelectItem>
                          <SelectItem value="Educational">Educational</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Government">Government</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-foreground">{org.type}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="status">Status</Label>
                    {isEditing ? (
                      <Select
                        value={org.status}
                        onValueChange={(v) => setOrg({ ...org, status: v as OrgStatus })}
                      >
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={statusStyles[org.status]}>{org.status}</Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="website">Website</Label>
                    {isEditing ? (
                      <Input
                        id="website"
                        value={org.website}
                        onChange={(e) => setOrg({ ...org, website: e.target.value })}
                      />
                    ) : (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {org.website}
                      </a>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  {isEditing ? (
                    <Textarea
                      id="notes"
                      value={org.notes}
                      onChange={(e) => setOrg({ ...org, notes: e.target.value })}
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{org.notes || "No notes"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Primary Contact</CardTitle>
                <CardDescription>Main point of contact for this organization</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="contact">Contact Name</Label>
                    {isEditing ? (
                      <Input
                        id="contact"
                        value={org.contact}
                        onChange={(e) => setOrg({ ...org, contact: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{org.contact}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email</Label>
                    {isEditing ? (
                      <Input
                        id="email"
                        type="email"
                        value={org.email}
                        onChange={(e) => setOrg({ ...org, email: e.target.value })}
                      />
                    ) : (
                      <a href={`mailto:${org.email}`} className="text-sm text-primary hover:underline">
                        {org.email}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    {isEditing ? (
                      <Input
                        id="phone"
                        value={org.phone}
                        onChange={(e) => setOrg({ ...org, phone: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{org.phone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
                <CardDescription>Organization location</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="address">Street Address</Label>
                    {isEditing ? (
                      <Input
                        id="address"
                        value={org.address}
                        onChange={(e) => setOrg({ ...org, address: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{org.address}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="city">City</Label>
                    {isEditing ? (
                      <Input
                        id="city"
                        value={org.city}
                        onChange={(e) => setOrg({ ...org, city: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{org.city}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="state">State</Label>
                      {isEditing ? (
                        <Input
                          id="state"
                          value={org.state}
                          onChange={(e) => setOrg({ ...org, state: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm text-foreground">{org.state}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="zip">ZIP Code</Label>
                      {isEditing ? (
                        <Input
                          id="zip"
                          value={org.zip}
                          onChange={(e) => setOrg({ ...org, zip: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm text-foreground">{org.zip}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date Added</p>
                    <p className="text-sm font-medium">
                      {new Date(org.dateAdded).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{org.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{org.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">{org.city}, {org.state}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related People</CardTitle>
                <CardDescription>People associated with this organization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{org.contact}</p>
                    <p className="text-xs text-muted-foreground">Primary Contact</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

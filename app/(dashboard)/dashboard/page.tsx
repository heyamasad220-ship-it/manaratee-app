"use client"
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { getCurrentOrganizationId } from "@/lib/current-organization";
import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Upload,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  ExternalLink,
  CalendarDays,
  ClipboardList,
  Ticket,
  Store,
  Heart,
  Users,
  Calendar,
} from "lucide-react"

// Mock organization data
const organizationData = {
  name: "Al-Noor Islamic Center",
  logo: null,
  tagline: "Serving the community with faith and compassion",
  description: "Al-Noor Islamic Center is a vibrant community hub dedicated to providing religious services, educational programs, and community support. Founded in 1995, we have grown to serve over 2,000 families in the greater metropolitan area.",
  email: "info@alnoor-ic.org",
  phone: "+1 (555) 123-4567",
  website: "https://www.alnoor-ic.org",
  address: {
    street: "1234 Faith Avenue",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    country: "United States",
  },
  socialMedia: {
    facebook: "https://facebook.com/alnooricenter",
    instagram: "https://instagram.com/alnooricenter",
    twitter: "https://twitter.com/alnooricenter",
    linkedin: "",
    youtube: "https://youtube.com/@alnooricenter",
  },
  quickLinks: [
    { label: "Prayer Times", url: "/prayer-times" },
    { label: "Donate", url: "/donations" },
    { label: "Events Calendar", url: "/events/calendar" },
    { label: "Contact Us", url: "/contact" },
  ],
}

// Subscribed modules
const subscribedModules = [
  { id: "internal-events", name: "Internal Events", icon: CalendarDays, enabled: true, href: "/events/overview" },
  { id: "sign-ups", name: "Sign-Ups", icon: ClipboardList, enabled: true, href: "/sign-ups/overview" },
  { id: "tickets", name: "Ticketing", icon: Ticket, enabled: true, href: "/tickets" },
  { id: "bookings", name: "Bookings", icon: Calendar, enabled: true, href: "/events/calendar" },
  { id: "venue-rentals", name: "Venue Rentals", icon: Building2, enabled: true, href: "/events/external/overview" },
  { id: "bazaar", name: "Bazaar", icon: Store, enabled: true, href: "/bazaar" },
  { id: "donations", name: "Donations", icon: Heart, enabled: true, href: "/donations" },
  { id: "hr", name: "Human Resources", icon: Users, enabled: true, href: "/hr" },
]

export default function DashboardPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [showLogoDialog, setShowLogoDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [org, setOrg] = useState<any>({
  ...organizationData,
  name: "",
  contact_email: "",
})

  useEffect(() => {
    async function loadOrganization() {
      const supabase = createClient();

      const orgId = await getCurrentOrganizationId();

      if (!orgId) {
        console.error("No selected organization");
        return;
      }

      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (error) {
        console.error("Error loading organization:", error);
        return;
      }

      setOrg((prev: any) => ({
  ...prev,
  ...data,
}))
    }

    loadOrganization();
  }, []);
if (!org) {
  return <div className="p-6">Loading organization...</div>;
}
  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Organization Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {/* Logo */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="flex h-28 w-28 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary hover:bg-muted"
                    onClick={() => setShowLogoDialog(true)}
                  >
                    {org.logo ? (
                      <img src={org.logo} alt="Organization logo" className="h-full w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span className="text-xs">Upload Logo</span>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowLogoDialog(true)}>
                    Change Logo
                  </Button>
                </div>

                {/* Organization Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{org.name}</h2>
                      <p className="mt-1 text-muted-foreground">{org.tagline}</p>
                    </div>
                    <Button
                      variant={isEditing ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {isEditing ? "Save Changes" : "Edit"}
                    </Button>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input
                          id="org-name"
                          value={org.name}
                          onChange={(e) => setOrg({ ...org, name: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-tagline">Tagline</Label>
                        <Input
                          id="org-tagline"
                          value={org.tagline}
                          onChange={(e) => setOrg({ ...org, tagline: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-description">Description</Label>
                        <Textarea
                          id="org-description"
                          value={org.description}
                          onChange={(e) => setOrg({ ...org, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">{org.description}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Contact Information
                </CardTitle>
                <CardDescription>How people can reach your organization</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="org-email">Email</Label>
                      <Input
                        id="org-email"
                        type="email"
                        value={org.contact_email || ""}
                        onChange={(e) => setOrg({ ...org, contact_email: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="org-phone">Phone</Label>
                      <Input
                        id="org-phone"
                        value={org.phone}
                        onChange={(e) => setOrg({ ...org, phone: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="org-website">Website</Label>
                      <Input
                        id="org-website"
                        value={org.website}
                        onChange={(e) => setOrg({ ...org, website: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="org-street">Street Address</Label>
                      <Input
                        id="org-street"
                        value={org.address?.street || ""}
                        onChange={(e) => setOrg({ ...org, address: { ...org.address, street: e.target.value } })}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-city">City</Label>
                        <Input
                          id="org-city"
                          value={org.address?.city || ""}
                      
                         onChange={(e) =>
  setOrg({
    ...org,
    address: {
      ...(org.address || {}),
      city: e.target.value,
    },
  })
}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-state">State</Label>
                        <Input
                          id="org-state"
                          value={org.address?.state || ""}
onChange={(e) =>
  setOrg({
    ...org,
    address: {
      ...(org.address || {}),
      state: e.target.value,
    },
  })
}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-zip">ZIP Code</Label>
                        <Input
                          id="org-zip"
                          value={org.address?.zip || ""}
onChange={(e) =>
  setOrg({
    ...org,
    address: {
      ...(org.address || {}),
      zip: e.target.value,
    },
  })
}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${org.email}`} className="text-sm text-primary hover:underline">
                        {org.contact_email || "No email set"}
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${org.phone}`} className="text-sm hover:underline">
                        {org.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                        {org.website}
                      </a>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="text-sm">
                        {org.address ? (
  <div className="text-sm">
    {org.address ? (
  <>
    <p>{org.address.street}</p>
    <p>
      {org.address.city}, {org.address.state} {org.address.zip}
    </p>
    <p>{org.address.country}</p>
  </>
) : (
  <p>No address set yet</p>
)}
  </div>
) : (
  <div className="text-sm">
    <p>No address set yet</p>
  </div>
)}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Social Media */}
            <Card>
              <CardHeader>
                <CardTitle>Social Media</CardTitle>
                <CardDescription>Connect with your community on social platforms</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <Facebook className="h-5 w-5 text-[#1877F2]" />
                      <Input
                        placeholder="Facebook URL"
                        value={org.socialMedia.facebook}
                        onChange={(e) => setOrg({ ...org, socialMedia: { ...org.socialMedia, facebook: e.target.value } })}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Instagram className="h-5 w-5 text-[#E4405F]" />
                      <Input
                        placeholder="Instagram URL"
                        value={org.socialMedia.instagram}
                        onChange={(e) => setOrg({ ...org, socialMedia: { ...org.socialMedia, instagram: e.target.value } })}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                      <Input
                        placeholder="Twitter/X URL"
                        value={org.socialMedia.twitter}
                        onChange={(e) => setOrg({ ...org, socialMedia: { ...org.socialMedia, twitter: e.target.value } })}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                      <Input
                        placeholder="LinkedIn URL"
                        value={org.socialMedia.linkedin}
                        onChange={(e) => setOrg({ ...org, socialMedia: { ...org.socialMedia, linkedin: e.target.value } })}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Youtube className="h-5 w-5 text-[#FF0000]" />
                      <Input
                        placeholder="YouTube URL"
                        value={org.socialMedia.youtube}
                        onChange={(e) => setOrg({ ...org, socialMedia: { ...org.socialMedia, youtube: e.target.value } })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {org.socialMedia.facebook && (
                      <a
                        href={org.socialMedia.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Facebook className="h-5 w-5 text-[#1877F2]" />
                        <span className="text-sm">Facebook</span>
                      </a>
                    )}
                    {org.socialMedia.instagram && (
                      <a
                        href={org.socialMedia.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Instagram className="h-5 w-5 text-[#E4405F]" />
                        <span className="text-sm">Instagram</span>
                      </a>
                    )}
                    {org.socialMedia.twitter && (
                      <a
                        href={org.socialMedia.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                        <span className="text-sm">Twitter</span>
                      </a>
                    )}
                    {org.socialMedia.linkedin && (
                      <a
                        href={org.socialMedia.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                        <span className="text-sm">LinkedIn</span>
                      </a>
                    )}
                    {org.socialMedia.youtube && (
                      <a
                        href={org.socialMedia.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Youtube className="h-5 w-5 text-[#FF0000]" />
                        <span className="text-sm">YouTube</span>
                      </a>
                    )}
                    {!org.socialMedia.facebook && !org.socialMedia.instagram && !org.socialMedia.twitter && !org.socialMedia.linkedin && !org.socialMedia.youtube && (
                      <p className="text-sm text-muted-foreground">No social media links added yet. Click Edit to add them.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Quick Links</CardTitle>
                  <CardDescription>Frequently accessed pages for your visitors</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
                  Add Link
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {organizationData.quickLinks.map((link, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{link.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{link.url}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Subscribed Modules */}
            <Card>
              <CardHeader>
                <CardTitle>Subscribed Modules</CardTitle>
                <CardDescription>Modules your organization has access to</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {subscribedModules.map((module) => (
                    <a
                      key={module.id}
                      href={module.href}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <module.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{module.name}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          Active
                        </Badge>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Logo Upload Dialog */}
      <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Organization Logo</DialogTitle>
            <DialogDescription>
              Upload a logo for your organization. Recommended size: 200x200 pixels.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-10 w-10" />
                <span className="text-sm">Drop image here</span>
              </div>
            </div>
            <Button variant="outline">Choose File</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowLogoDialog(false)}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Quick Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Quick Link</DialogTitle>
            <DialogDescription>
              Add a frequently accessed page for easy navigation.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="link-label">Link Label</Label>
              <Input id="link-label" placeholder="e.g., Prayer Times" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="link-url">URL</Label>
              <Input id="link-url" placeholder="/page-path or https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowLinkDialog(false)}>
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

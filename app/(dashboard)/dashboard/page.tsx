"use client"

import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  isDashboardSubscribedModule,
  staffModuleDisplayName,
} from "@/lib/modules/staff-module-labels"
import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"

type Address = {
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

type SocialMedia = {
  facebook?: string
  instagram?: string
  twitter?: string
  linkedin?: string
  youtube?: string
}

type QuickLink = {
  label: string
  url: string
}

type SubscribedModule = {
  slug: string
  name: string
}

type Organization = {
  id?: string
  name?: string
  logo?: string | null
  logo_url?: string | null
  tagline?: string | null
  description?: string | null
  contact_email?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: Address | null
  socialMedia?: SocialMedia | null
  social_media?: SocialMedia | null
  quickLinks?: QuickLink[] | null
  quick_links?: QuickLink[] | null
}

const emptyOrganization: Organization = {
  name: "",
  logo: null,
  logo_url: null,
  tagline: "",
  description: "",
  contact_email: "",
  email: "",
  phone: "",
  website: "",
  address: {
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  },
  socialMedia: {
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
    youtube: "",
  },
  quickLinks: [],
}

export default function DashboardPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [showLogoDialog, setShowLogoDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgSnapshot, setOrgSnapshot] = useState<Organization | null>(null)
  const [subscribedModules, setSubscribedModules] = useState<SubscribedModule[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function loadOrganization() {
      const supabase = createClient()

      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        console.error("No selected organization")
        setOrg(emptyOrganization)
        setSubscribedModules([])
        setIsLoading(false)
        return
      }

      const [{ data, error }, modulesResponse] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).single(),
        fetch("/api/organizations/sidebar-modules", { cache: "no-store" }),
      ])

      if (error) {
        console.error("Error loading organization:", error)
        setOrg(emptyOrganization)
        setIsLoading(false)
        return
      }

      setOrg({
        ...emptyOrganization,
        ...data,
        socialMedia: data.social_media || data.socialMedia || emptyOrganization.socialMedia,
        quickLinks: data.quick_links || data.quickLinks || [],
        address: data.address || emptyOrganization.address,
      })

      if (modulesResponse.ok) {
        const payload = (await modulesResponse.json()) as {
          modules?: Array<{ slug?: string; name?: string; sort_order?: number | null }>
        }
        const modules = (payload.modules || [])
          .filter((row) => typeof row.slug === "string" && isDashboardSubscribedModule(row.slug))
          .map((row) => ({
            slug: row.slug as string,
            name: staffModuleDisplayName(row.slug as string, row.name),
            sortOrder: row.sort_order ?? 999,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          .map(({ slug, name }) => ({ slug, name }))

        const unique = new Map<string, SubscribedModule>()
        for (const module of modules) {
          unique.set(staffModuleDisplayName(module.slug), module)
        }
        setSubscribedModules(Array.from(unique.values()))
      } else {
        setSubscribedModules([])
      }

      setIsLoading(false)
    }

    loadOrganization()
  }, [])

  async function saveOrganization() {
    if (!org?.id) {
      setOrgSnapshot(null)
      setShowLogoDialog(false)
      setIsEditing(false)
      return
    }

    setIsSaving(true)

    const supabase = createClient()

    const { error } = await supabase
      .from("organizations")
      .update({
        name: org.name || "",
        tagline: org.tagline || "",
        description: org.description || "",
        contact_email: org.contact_email || "",
        phone: org.phone || "",
        website: org.website || "",
        address: org.address || {},
        social_media: org.socialMedia || {},
        quick_links: org.quickLinks || [],
      })
      .eq("id", org.id)

    if (error) {
      console.error("Error saving organization:", error)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    setOrgSnapshot(null)
    setShowLogoDialog(false)
    setIsEditing(false)
  }

  function startEditing() {
    if (!org) return
    setOrgSnapshot(structuredClone(org))
    setIsEditing(true)
  }

  function cancelEditing() {
    if (orgSnapshot) {
      setOrg({
        ...orgSnapshot,
        logo: org?.logo ?? orgSnapshot.logo,
        logo_url: org?.logo_url ?? orgSnapshot.logo_url,
      })
    }
    setOrgSnapshot(null)
    setShowLogoDialog(false)
    setIsEditing(false)
  }

  function updateAddress(field: keyof Address, value: string) {
    setOrg((current) => ({
      ...(current || emptyOrganization),
      address: {
        ...(current?.address || {}),
        [field]: value,
      },
    }))
  }

  function updateSocialMedia(field: keyof SocialMedia, value: string) {
    setOrg((current) => ({
      ...(current || emptyOrganization),
      socialMedia: {
        ...(current?.socialMedia || {}),
        [field]: value,
      },
    }))
  }

  const logoUrl = org?.logo_url || org?.logo || null
  const socialMedia = org?.socialMedia || {}
  const quickLinks = org?.quickLinks || []

  if (isLoading || !org) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6">Loading organization...</div>
      </>
    )
  }

  return (
    <>
      <Header title="Dashboard" />

      <div className="p-6">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={
                      logoUrl
                        ? isEditing
                          ? "inline-flex max-h-40 max-w-[18rem] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-white p-2 transition-colors hover:border-primary hover:bg-muted/40"
                          : "inline-flex max-h-40 max-w-[18rem] items-center justify-center bg-white"
                        : isEditing
                          ? "flex h-28 w-28 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary hover:bg-muted"
                          : "flex h-28 w-28 items-center justify-center rounded-xl border bg-muted/40"
                    }
                    onClick={
                      isEditing ? () => setShowLogoDialog(true) : undefined
                    }
                    role={isEditing ? "button" : undefined}
                    tabIndex={isEditing ? 0 : undefined}
                    onKeyDown={
                      isEditing
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              setShowLogoDialog(true)
                            }
                          }
                        : undefined
                    }
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Organization logo"
                        className="h-auto max-h-36 w-auto max-w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span className="text-xs">
                          {isEditing ? "Upload Logo" : "No logo"}
                        </span>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLogoDialog(true)}
                    >
                      Change Logo
                    </Button>
                  ) : null}
                </div>

                <div className="flex-1">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {org.name || "Organization name not set"}
                    </h2>

                    <p className="mt-1 text-muted-foreground">
                      {org.tagline || "No tagline set yet"}
                    </p>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input
                          id="org-name"
                          value={org.name || ""}
                          onChange={(e) =>
                            setOrg({ ...org, name: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-tagline">Tagline</Label>
                        <Input
                          id="org-tagline"
                          value={org.tagline || ""}
                          onChange={(e) =>
                            setOrg({ ...org, tagline: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-description">Description</Label>
                        <Textarea
                          id="org-description"
                          value={org.description || ""}
                          onChange={(e) =>
                            setOrg({ ...org, description: e.target.value })
                          }
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {org.description || "No description set yet"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Contact Information
                </CardTitle>
                <CardDescription>
                  How people can reach your organization
                </CardDescription>
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
                        onChange={(e) =>
                          setOrg({ ...org, contact_email: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="org-phone">Phone</Label>
                      <Input
                        id="org-phone"
                        value={org.phone || ""}
                        onChange={(e) =>
                          setOrg({ ...org, phone: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="org-website">Website</Label>
                      <Input
                        id="org-website"
                        value={org.website || ""}
                        onChange={(e) =>
                          setOrg({ ...org, website: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="org-street">Street Address</Label>
                      <Input
                        id="org-street"
                        value={org.address?.street || ""}
                        onChange={(e) => updateAddress("street", e.target.value)}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-city">City</Label>
                        <Input
                          id="org-city"
                          value={org.address?.city || ""}
                          onChange={(e) => updateAddress("city", e.target.value)}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-state">State</Label>
                        <Input
                          id="org-state"
                          value={org.address?.state || ""}
                          onChange={(e) =>
                            updateAddress("state", e.target.value)
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="org-zip">ZIP Code</Label>
                        <Input
                          id="org-zip"
                          value={org.address?.zip || ""}
                          onChange={(e) => updateAddress("zip", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {org.contact_email ? (
                        <a
                          href={`mailto:${org.contact_email}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {org.contact_email}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No email set
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {org.phone ? (
                        <a
                          href={`tel:${org.phone}`}
                          className="text-sm hover:underline"
                        >
                          {org.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No phone set
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {org.website ? (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {org.website}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No website set
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="text-sm">
                        {org.address?.street ||
                        org.address?.city ||
                        org.address?.state ||
                        org.address?.zip ||
                        org.address?.country ? (
                          <>
                            {org.address?.street && <p>{org.address.street}</p>}
                            {(org.address?.city ||
                              org.address?.state ||
                              org.address?.zip) && (
                              <p>
                                {org.address?.city}
                                {org.address?.city &&
                                  (org.address?.state || org.address?.zip) &&
                                  ", "}
                                {org.address?.state} {org.address?.zip}
                              </p>
                            )}
                            {org.address?.country && (
                              <p>{org.address.country}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-muted-foreground">
                            No address set yet
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Media</CardTitle>
                <CardDescription>
                  Connect with your community on social platforms
                </CardDescription>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <Facebook className="h-5 w-5 text-[#1877F2]" />
                      <Input
                        placeholder="Facebook URL"
                        value={socialMedia.facebook || ""}
                        onChange={(e) =>
                          updateSocialMedia("facebook", e.target.value)
                        }
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Instagram className="h-5 w-5 text-[#E4405F]" />
                      <Input
                        placeholder="Instagram URL"
                        value={socialMedia.instagram || ""}
                        onChange={(e) =>
                          updateSocialMedia("instagram", e.target.value)
                        }
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                      <Input
                        placeholder="Twitter/X URL"
                        value={socialMedia.twitter || ""}
                        onChange={(e) =>
                          updateSocialMedia("twitter", e.target.value)
                        }
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                      <Input
                        placeholder="LinkedIn URL"
                        value={socialMedia.linkedin || ""}
                        onChange={(e) =>
                          updateSocialMedia("linkedin", e.target.value)
                        }
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Youtube className="h-5 w-5 text-[#FF0000]" />
                      <Input
                        placeholder="YouTube URL"
                        value={socialMedia.youtube || ""}
                        onChange={(e) =>
                          updateSocialMedia("youtube", e.target.value)
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {socialMedia.facebook && (
                      <a
                        href={socialMedia.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Facebook className="h-5 w-5 text-[#1877F2]" />
                        <span className="text-sm">Facebook</span>
                      </a>
                    )}

                    {socialMedia.instagram && (
                      <a
                        href={socialMedia.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Instagram className="h-5 w-5 text-[#E4405F]" />
                        <span className="text-sm">Instagram</span>
                      </a>
                    )}

                    {socialMedia.twitter && (
                      <a
                        href={socialMedia.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                        <span className="text-sm">Twitter</span>
                      </a>
                    )}

                    {socialMedia.linkedin && (
                      <a
                        href={socialMedia.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                        <span className="text-sm">LinkedIn</span>
                      </a>
                    )}

                    {socialMedia.youtube && (
                      <a
                        href={socialMedia.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <Youtube className="h-5 w-5 text-[#FF0000]" />
                        <span className="text-sm">YouTube</span>
                      </a>
                    )}

                    {!socialMedia.facebook &&
                      !socialMedia.instagram &&
                      !socialMedia.twitter &&
                      !socialMedia.linkedin &&
                      !socialMedia.youtube && (
                        <p className="text-sm text-muted-foreground">
                          No social media links added yet. Click Edit to add
                          them.
                        </p>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Quick Links</CardTitle>
                  <CardDescription>
                    Frequently accessed pages for your visitors
                  </CardDescription>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLinkDialog(true)}
                >
                  Add Link
                </Button>
              </CardHeader>

              <CardContent>
                <div className="flex flex-col gap-2">
                  {quickLinks.length > 0 ? (
                    quickLinks.map((link, index) => (
                      <div
                        key={`${link.label}-${index}`}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {link.label}
                          </span>
                        </div>

                        <span className="text-xs text-muted-foreground">
                          {link.url}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No quick links added yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscribed Modules</CardTitle>
                <CardDescription>
                  Modules your organization has access to
                </CardDescription>
              </CardHeader>

              <CardContent>
                {subscribedModules.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {subscribedModules.map((module) => (
                      <Badge key={module.slug} variant="secondary">
                        {module.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No subscribed modules found.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void saveOrganization()
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={startEditing}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={isEditing && showLogoDialog}
        onOpenChange={(open) => {
          if (!isEditing) return
          setShowLogoDialog(open)
        }}
      >
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Upload Organization Logo</DialogTitle>
      <DialogDescription>
        Upload a PNG, SVG, or JPG. Wide or square logos both work — the preview
        keeps the full image without cropping.
      </DialogDescription>
    </DialogHeader>

    <div className="flex flex-col items-center gap-4 py-4">
      <div
        className={
          logoUrl
            ? "inline-flex max-h-48 max-w-full items-center justify-center rounded-xl border-2 border-dashed border-border bg-white p-3"
            : "flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50"
        }
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Organization logo"
            className="h-auto max-h-44 w-auto max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-10 w-10" />
            <span className="text-sm">Choose image</span>
          </div>
        )}
      </div>

      <Input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0]

          if (!file || !org?.id) return

          const supabase = createClient()

          const fileExt = file.name.split(".").pop()
          const filePath = `${org.id}/logo-${Date.now()}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from("organization-logos")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: true,
            })

          if (uploadError) {
            console.error("Logo upload error:", uploadError)
            return
          }

          const { data } = supabase.storage
            .from("organization-logos")
            .getPublicUrl(filePath)

          const publicUrl = data.publicUrl

          const { error: updateError } = await supabase
            .from("organizations")
            .update({
              logo_url: publicUrl,
            })
            .eq("id", org.id)

          if (updateError) {
            console.error("Logo save error:", updateError)
            return
          }

          setOrg({
            ...org,
            logo_url: publicUrl,
          })

          setShowLogoDialog(false)
        }}
      />
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowLogoDialog(false)}>
        Cancel
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

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
            <Button onClick={() => setShowLinkDialog(false)}>Add Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  updateCustomerVendorProfileAction,
  type CustomerVendorProfile,
} from "@/lib/vendor-hub/customer-vendor-profile-actions"

const NO_TYPE = "__none__"

export function CustomerVendorProfileClient({
  profile,
}: {
  profile: CustomerVendorProfile
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [firstName, setFirstName] = useState(profile.firstName)
  const [lastName, setLastName] = useState(profile.lastName)
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [businessName, setBusinessName] = useState(profile.businessName)
  const [vendorTypeId, setVendorTypeId] = useState(profile.vendorTypeId || NO_TYPE)
  const [facebook, setFacebook] = useState(profile.facebook)
  const [instagram, setInstagram] = useState(profile.instagram)
  const [website, setWebsite] = useState(profile.website)
  const [productsServices, setProductsServices] = useState(profile.productsServices)
  const [yearsInBusiness, setYearsInBusiness] = useState(profile.yearsInBusiness)
  const [serviceArea, setServiceArea] = useState(profile.serviceArea)

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateCustomerVendorProfileAction({
        organizationId: profile.organizationId,
        firstName,
        lastName,
        email,
        phone,
        businessName,
        vendorTypeId: vendorTypeId === NO_TYPE ? null : vendorTypeId,
        facebook,
        instagram,
        website,
        productsServices,
        yearsInBusiness,
        serviceArea,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
          <Link href="/customer/bazaars">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            My Bazaars
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendor profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your business details and social links. This is the same profile staff see in
            the Vendor Network — no duplicate account.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
          <CardDescription>Name and how organizers reach you.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vendor-first-name">First name *</Label>
            <Input
              id="vendor-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-last-name">Last name *</Label>
            <Input
              id="vendor-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-email">Email *</Label>
            <Input
              id="vendor-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-phone">Phone *</Label>
            <Input
              id="vendor-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={pending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business</CardTitle>
          <CardDescription>How you appear to organizers and shoppers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-business">Business name *</Label>
            <Input
              id="vendor-business"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label>Type of business</Label>
            <Select
              value={vendorTypeId}
              onValueChange={setVendorTypeId}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TYPE}>None</SelectItem>
                {profile.vendorTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-products">Products or services *</Label>
            <Textarea
              id="vendor-products"
              rows={4}
              value={productsServices}
              onChange={(event) => setProductsServices(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-years">Years in business</Label>
              <Input
                id="vendor-years"
                value={yearsInBusiness}
                onChange={(event) => setYearsInBusiness(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-area">City / service area</Label>
              <Input
                id="vendor-area"
                value={serviceArea}
                onChange={(event) => setServiceArea(event.target.value)}
                disabled={pending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social media & website</CardTitle>
          <CardDescription>Optional links for your vendor listing.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="vendor-website">Website</Label>
            <Input
              id="vendor-website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://…"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-facebook">Facebook</Label>
            <Input
              id="vendor-facebook"
              value={facebook}
              onChange={(event) => setFacebook(event.target.value)}
              placeholder="https://facebook.com/…"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-instagram">Instagram</Label>
            <Input
              id="vendor-instagram"
              value={instagram}
              onChange={(event) => setInstagram(event.target.value)}
              placeholder="@handle or https://instagram.com/…"
              disabled={pending}
            />
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Vendor profile saved.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save profile"
          )}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/customer/bazaars">Back to My Bazaars</Link>
        </Button>
      </div>
    </div>
  )
}

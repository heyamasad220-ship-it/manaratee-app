"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { DirectoryAddMenu } from "@/components/directory/directory-add-menu"
import { ContactsFamiliesDirectoryPanel } from "@/components/contacts/contacts-families-directory-panel"
import { FamilyContactPicker } from "@/components/contacts/family-contact-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createDirectoryFamilyAction } from "@/lib/contacts/family-management-actions"
import { DIRECTORY_FAMILIES_PATH } from "@/lib/directory/directory-paths"

export function DirectoryFamiliesClient() {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [primaryContactId, setPrimaryContactId] = useState("")
  const [primaryContactName, setPrimaryContactName] = useState("")
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (searchParams.get("add") === "1") setOpen(true)
  }, [searchParams])

  async function handleSave() {
    setSaving(true)
    const result = await createDirectoryFamilyAction({
      name,
      primaryContactId: primaryContactId || undefined,
    })
    setSaving(false)
    if (!result.success) {
      alert(result.error)
      return
    }
    setOpen(false)
    setName("")
    setPrimaryContactId("")
    setPrimaryContactName("")
    setRefreshKey((value) => value + 1)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Families</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Households are relationships between people. Each member stays a single person record.
          </p>
        </div>
        <DirectoryAddMenu />
      </div>
      <ContactsFamiliesDirectoryPanel
        key={refreshKey}
        returnTo={DIRECTORY_FAMILIES_PATH}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Family</DialogTitle>
            <DialogDescription>
              Create a household and optionally choose a primary contact. Minors stay linked people,
              not separate user accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="family-name">Family / household name</Label>
              <Input
                id="family-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ali Family"
              />
            </div>
            <div className="flex flex-col gap-2">
              <FamilyContactPicker
                selectedContactId={primaryContactId || null}
                selectedLabel={primaryContactName || "Search existing people"}
                onChange={(contactId, label) => {
                  setPrimaryContactId(contactId)
                  setPrimaryContactName(label)
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save family"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

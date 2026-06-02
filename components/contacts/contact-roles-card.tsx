"use client"

import { useEffect, useState } from "react"
import { Pencil } from "lucide-react"
import { syncContactRoles } from "@/lib/contacts/contact-actions"
import {
  type ContactRoleValue,
  ROLE_COLORS,
  ROLE_OPTIONS,
  ROLE_VALUE_TO_LABEL,
} from "@/lib/contacts/contact-constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ContactRolesCardProps = {
  contactId: string
  roles: ContactRoleValue[]
  contactInfo: {
    fullName: string
    email?: string | null
    phone?: string | null
  }
  onRolesUpdated: () => void
}

export function ContactRolesCard({
  contactId,
  roles,
  contactInfo,
  onRolesUpdated,
}: ContactRolesCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editRoles, setEditRoles] = useState<ContactRoleValue[]>(roles)

  useEffect(() => {
    setEditRoles(roles)
  }, [roles])

  function toggleRole(role: ContactRoleValue, checked: boolean) {
    if (checked) {
      setEditRoles(Array.from(new Set([...editRoles, role])))
      return
    }
    setEditRoles(editRoles.filter((item) => item !== role))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await syncContactRoles(contactId, editRoles, contactInfo)
      setIsOpen(false)
      onRolesUpdated()
    } catch (error: any) {
      alert(error?.message || "Could not update roles")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Roles</h2>
            <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Roles
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Stable affiliations such as donor, volunteer, vendor, or employee. Customer status is
            inferred from program, ticket, booking, and payment activity — not stored as a role.
          </p>
          <div className="flex flex-wrap gap-2">
            {roles.length === 0 ? (
              <Badge variant="secondary">No roles assigned</Badge>
            ) : (
              roles.map((role) => (
                <Badge
                  key={role}
                  variant="secondary"
                  className={ROLE_COLORS[ROLE_VALUE_TO_LABEL[role]]}
                >
                  {ROLE_VALUE_TO_LABEL[role]}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Roles</DialogTitle>
            <DialogDescription>
              Add or remove affiliations. A contact may have multiple roles.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_OPTIONS.map((role) => (
              <label
                key={role.value}
                htmlFor={`role-${role.value}`}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <Checkbox
                  id={`role-${role.value}`}
                  checked={editRoles.includes(role.value)}
                  onCheckedChange={(checked) => toggleRole(role.value, checked === true)}
                />
                {role.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

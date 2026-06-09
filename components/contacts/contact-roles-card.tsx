"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil } from "lucide-react"
import { syncContactRoles } from "@/lib/contacts/contact-actions"
import { DERIVED_AFFILIATION_ROLES } from "@/lib/contacts/contact-affiliation-rules"
import {
  type ContactRecordType,
  type ContactRoleValue,
  ROLE_COLORS,
  ROLE_VALUE_TO_LABEL,
  getAllowedRolesForRecordType,
  getEditableRoleOptionsForRecordType,
} from "@/lib/contacts/contact-constants"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"
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

type ContactRoleRow = {
  role: ContactRoleValue
  is_manual?: boolean
}

type ContactRolesCardProps = {
  contactId: string
  roles: ContactRoleValue[]
  roleRows?: ContactRoleRow[]
  contactType?: ContactRecordType
  contactInfo: {
    fullName: string
    email?: string | null
    phone?: string | null
  }
  onRolesUpdated: () => void
}

function affiliationSourceLabel(role: ContactRoleValue, isManual?: boolean) {
  const isDerived = DERIVED_AFFILIATION_ROLES.includes(
    role as (typeof DERIVED_AFFILIATION_ROLES)[number]
  )

  if (!isDerived) {
    return isManual ? "Manual" : null
  }
  if (isManual) return "Manual override"
  if (role === "member") return "Via membership"
  if (role === "employee" || role === "volunteer" || role === "childcare_provider") {
    return WORKFORCE_MODULE_LABEL
  }
  if (role === "vendor") return "Vendor Hub"
  return "Automatic"
}

export function ContactRolesCard({
  contactId,
  roles,
  roleRows = [],
  contactType = "individual",
  contactInfo,
  onRolesUpdated,
}: ContactRolesCardProps) {
  const isOrganization = contactType === "organization"
  const roleOptions = getEditableRoleOptionsForRecordType(contactType)
  const editableRoleValues = useMemo(
    () => new Set(roleOptions.map((option) => option.value)),
    [roleOptions]
  )
  const visibleRoles = roles.filter((role) =>
    getAllowedRolesForRecordType(contactType).includes(role)
  )
  const editableRoles = visibleRoles.filter((role) => editableRoleValues.has(role))
  const automaticRoles = visibleRoles.filter((role) => !editableRoleValues.has(role))
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editRoles, setEditRoles] = useState<ContactRoleValue[]>(roles)

  const manualByRole = useMemo(() => {
    const map = new Map<ContactRoleValue, boolean>()
    for (const row of roleRows) {
      map.set(row.role, row.is_manual === true)
    }
    return map
  }, [roleRows])

  useEffect(() => {
    setEditRoles(editableRoles)
  }, [editableRoles.join(",")])

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
      await syncContactRoles(
        contactId,
        [...editRoles, ...automaticRoles],
        contactInfo
      )
      setIsOpen(false)
      onRolesUpdated()
    } catch (error: any) {
      alert(error?.message || "Could not update roles")
    } finally {
      setSaving(false)
    }
  }

  function renderAffiliationBadge(role: ContactRoleValue) {
    const source = affiliationSourceLabel(role, manualByRole.get(role))
    const label = ROLE_VALUE_TO_LABEL[role]

    return (
      <Badge
        key={role}
        variant="secondary"
        className={ROLE_COLORS[label]}
        title={source ?? undefined}
      >
        {label}
        {source ? (
          <span className="ml-1.5 font-normal opacity-70">({source.toLowerCase()})</span>
        ) : null}
      </Badge>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Affiliations</h2>
            <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit affiliations
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {isOrganization
              ? "Donor is added automatically when this organization gives. Customer and service provider labels can be edited here."
              : "Donor, vendor, and child care provider affiliations sync from applications and activity. Service provider and donor can also be set manually."}
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleRoles.length === 0 ? (
              <Badge variant="secondary">No affiliations assigned</Badge>
            ) : (
              visibleRoles.map((role) => renderAffiliationBadge(role))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit affiliations</DialogTitle>
            <DialogDescription>
              {isOrganization
                ? "Select customer or service provider labels. Donor is applied automatically when this organization donates."
                : "Add or remove manual affiliations. Vendor, child care provider, workforce, membership, and donor (when giving history exists) are managed by activity sync."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {roleOptions.map((role) => (
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
          {automaticRoles.length > 0 ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Automatic affiliations</p>
              <p className="mt-1">
                {automaticRoles.map((role) => ROLE_VALUE_TO_LABEL[role]).join(", ")} — synced from
                module activity and not edited here.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save affiliations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

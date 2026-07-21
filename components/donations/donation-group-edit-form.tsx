"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { STATUS_OPTIONS } from "@/lib/contacts/contact-constants"
import {
  listGivingGroupLinkOptionsAction,
  updateGivingGroupAction,
} from "@/lib/donations/giving-group-actions"
import {
  GIVING_GROUP_KIND_OPTIONS,
  normalizeGivingGroupKind,
  type GivingGroupKind,
} from "@/lib/donations/giving-group-kind"

type DonationGroupEditFormProps = {
  group: {
    id: string
    full_name: string | null
    primary_contact_name: string | null
    status: string | null
    notes: string | null
    giving_group_kind?: string | null
    linked_hr_team_id?: string | null
    linked_department_id?: string | null
  }
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

export function DonationGroupEditForm({
  group,
  onCancel,
  onSaved,
}: DonationGroupEditFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState(group.full_name || "")
  const [primaryContactName, setPrimaryContactName] = useState(
    group.primary_contact_name || ""
  )
  const [status, setStatus] = useState(group.status || "active")
  const [notes, setNotes] = useState(group.notes || "")
  const [kind, setKind] = useState<GivingGroupKind>(
    normalizeGivingGroupKind(group.giving_group_kind)
  )
  const [linkedHrTeamId, setLinkedHrTeamId] = useState(group.linked_hr_team_id || "")
  const [linkedDepartmentId, setLinkedDepartmentId] = useState(
    group.linked_department_id || ""
  )
  const [membershipGroups, setMembershipGroups] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [optionsLoading, setOptionsLoading] = useState(true)

  useEffect(() => {
    async function loadOptions() {
      setOptionsLoading(true)
      const result = await listGivingGroupLinkOptionsAction()
      if (result.success) {
        setMembershipGroups(result.membershipGroups)
        setDepartments(result.departments)
      }
      setOptionsLoading(false)
    }
    void loadOptions()
  }, [])

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateGivingGroupAction({
        groupContactId: group.id,
        fullName,
        primaryContactName,
        status,
        notes,
        givingGroupKind: kind,
        linkedHrTeamId: linkedHrTeamId || null,
        linkedDepartmentId: linkedDepartmentId || null,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      await onSaved()
    })
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="group-name">Group name</Label>
        <Input
          id="group-name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-primary">Primary contact name</Label>
        <Input
          id="group-primary"
          value={primaryContactName}
          onChange={(event) => setPrimaryContactName(event.target.value)}
          placeholder="Leader or coordinator"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as GivingGroupKind)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GIVING_GROUP_KIND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {GIVING_GROUP_KIND_OPTIONS.find((option) => option.value === kind)?.description}
      </p>

      {kind === "membership_group" ? (
        <div className="space-y-2">
          <Label>Membership Group</Label>
          <Select
            value={linkedHrTeamId || undefined}
            onValueChange={setLinkedHrTeamId}
            disabled={optionsLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={optionsLoading ? "Loading..." : "Select membership group"}
              />
            </SelectTrigger>
            <SelectContent>
              {membershipGroups.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {kind === "department" ? (
        <div className="space-y-2">
          <Label>Department</Label>
          <Select
            value={linkedDepartmentId || undefined}
            onValueChange={setLinkedDepartmentId}
            disabled={optionsLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={optionsLoading ? "Loading..." : "Select department"}
              />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="group-notes">Notes</Label>
        <Textarea
          id="group-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  )
}

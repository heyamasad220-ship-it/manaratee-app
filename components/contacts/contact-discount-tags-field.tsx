"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  filterManuallyAssignableDiscountTags,
  filterSystemManagedDiscountTags,
} from "@/lib/discount-tags/discount-tag-assignment"
import { setPersonDiscountTag } from "@/lib/people/person-tag-actions"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const NONE_VALUE = "__none__"

type DiscountTagOption = {
  id: string
  name: string
}

type ContactDiscountTagsFieldProps = {
  contactId: string
  editing: boolean
  className?: string
}

export function ContactDiscountTagsField({
  contactId,
  editing,
  className,
}: ContactDiscountTagsFieldProps) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [availableTags, setAvailableTags] = useState<DiscountTagOption[]>([])
  const [assignedTags, setAssignedTags] = useState<DiscountTagOption[]>([])
  const [selectedManualTagId, setSelectedManualTagId] = useState<string | null>(
    null
  )

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const { data: tags, error: tagsError } = await supabase
        .from("discount_tags")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true })

      if (tagsError) {
        throw new Error(tagsError.message)
      }

      const catalog = (tags || []) as DiscountTagOption[]

      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("person_id")
        .eq("id", contactId)
        .maybeSingle()

      if (contactError) {
        throw new Error(contactError.message)
      }

      let assigned: DiscountTagOption[] = []
      if (contact?.person_id) {
        const { data: personTags, error: personTagsError } = await supabase
          .from("person_tags")
          .select("tag_id, discount_tags:tag_id ( id, name )")
          .eq("person_id", contact.person_id)

        if (personTagsError) {
          throw new Error(personTagsError.message)
        }

        assigned = (personTags || [])
          .map((row) => {
            const tagRel = row.discount_tags as
              | { id?: string; name?: string }
              | { id?: string; name?: string }[]
              | null
            const tag = Array.isArray(tagRel) ? tagRel[0] : tagRel
            if (!tag?.id || !tag.name) return null
            return { id: tag.id, name: tag.name }
          })
          .filter((row): row is DiscountTagOption => Boolean(row))
      }

      const manualAssigned =
        filterManuallyAssignableDiscountTags(assigned)[0] || null

      setAvailableTags(catalog)
      setAssignedTags(assigned)
      setSelectedManualTagId(manualAssigned?.id ?? null)
    } catch (loadError) {
      console.error("Error loading discount tags:", loadError)
      setAvailableTags([])
      setAssignedTags([])
      setSelectedManualTagId(null)
    } finally {
      setLoading(false)
    }
  }, [contactId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  async function handleChange(value: string) {
    if (loading || !value || value === selectedManualTagId || (value === NONE_VALUE && !selectedManualTagId)) {
      return
    }
    const nextTagId = value === NONE_VALUE ? null : value
    const previous = selectedManualTagId
    setSelectedManualTagId(nextTagId)
    setSaving(true)
    try {
      const result = await setPersonDiscountTag(contactId, nextTagId)
      if (!result.success) {
        setSelectedManualTagId(previous)
        alert(result.error)
        return
      }
      await load()
    } catch (error) {
      console.error("Error updating discount tag:", error)
      setSelectedManualTagId(previous)
      alert(error instanceof Error ? error.message : "Could not update discount tag")
    } finally {
      setSaving(false)
    }
  }

  const systemAssigned = filterSystemManagedDiscountTags(assignedTags)
  const manualOptions = filterManuallyAssignableDiscountTags(availableTags)
  const displayNames =
    assignedTags.length > 0
      ? assignedTags.map((tag) => tag.name).join(", ")
      : null

  if (!editing) {
    return (
      <div className={cn(className)}>
        <dt className="text-xs font-medium text-muted-foreground">Discount tag</dt>
        <dd>{displayNames || "—"}</dd>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="profile-discount-tag">Discount tag</Label>
        <Select
          value={selectedManualTagId ?? NONE_VALUE}
          onValueChange={(value) => void handleChange(value)}
          disabled={loading || saving}
        >
          <SelectTrigger id="profile-discount-tag">
            <SelectValue placeholder={loading ? "Loading..." : "Select tag"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>None</SelectItem>
            {manualOptions.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {systemAssigned.length > 0 ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            Automatic tags
          </p>
          <p className="text-foreground">
            {systemAssigned.map((tag) => tag.name).join(", ")}
          </p>
        </div>
      ) : null}
    </div>
  )
}

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
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)

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

      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("person_id")
        .eq("id", contactId)
        .maybeSingle()

      if (contactError) {
        throw new Error(contactError.message)
      }

      let nextSelected: string | null = null
      if (contact?.person_id) {
        const { data: personTags, error: personTagsError } = await supabase
          .from("person_tags")
          .select("tag_id")
          .eq("person_id", contact.person_id)

        if (personTagsError) {
          throw new Error(personTagsError.message)
        }

        nextSelected = (personTags?.[0]?.tag_id as string | undefined) ?? null
      }

      setAvailableTags(tags || [])
      setSelectedTagId(nextSelected)
    } catch (loadError) {
      console.error("Error loading discount tags:", loadError)
      setAvailableTags([])
      setSelectedTagId(null)
    } finally {
      setLoading(false)
    }
  }, [contactId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  async function handleChange(value: string) {
    const nextTagId = value === NONE_VALUE ? null : value
    const previous = selectedTagId
    setSelectedTagId(nextTagId)
    setSaving(true)
    try {
      await setPersonDiscountTag(contactId, nextTagId)
    } catch (error) {
      console.error("Error updating discount tag:", error)
      setSelectedTagId(previous)
      alert(error instanceof Error ? error.message : "Could not update discount tag")
    } finally {
      setSaving(false)
    }
  }

  const selectedName =
    availableTags.find((tag) => tag.id === selectedTagId)?.name ?? null

  if (!editing) {
    return (
      <div className={cn(className)}>
        <dt className="text-xs font-medium text-muted-foreground">Discount tag</dt>
        <dd>{selectedName || "—"}</dd>
      </div>
    )
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor="profile-discount-tag">Discount tag</Label>
      <Select
        value={selectedTagId ?? NONE_VALUE}
        onValueChange={(value) => void handleChange(value)}
        disabled={loading || saving}
      >
        <SelectTrigger id="profile-discount-tag">
          <SelectValue placeholder={loading ? "Loading..." : "Select tag"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>None</SelectItem>
          {availableTags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {tag.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

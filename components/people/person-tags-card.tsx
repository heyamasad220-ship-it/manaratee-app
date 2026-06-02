"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { addPersonTag, removePersonTag } from "@/lib/people/person-tag-actions"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import { Loader2, Tags } from "lucide-react"

type DiscountTag = {
  id: string
  name: string
  description: string | null
  active: boolean
}

type PersonTagsCardProps = {
  contactId: string
  personId?: string | null
}

export function PersonTagsCard({ contactId, personId }: PersonTagsCardProps) {
  const supabase = React.useMemo(() => createClient(), [])

  const [loading, setLoading] = React.useState(true)
  const [savingTagId, setSavingTagId] = React.useState<string | null>(null)
  const [tags, setTags] = React.useState<DiscountTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([])

  const loadTags = React.useCallback(async () => {
    setLoading(true)

    const { data: tagData, error: tagError } = await supabase
      .from("discount_tags")
      .select("id, name, description, active")
      .eq("active", true)
      .order("name", { ascending: true })

    if (tagError) {
      console.error("Error loading discount tags:", tagError)
      setTags([])
      setSelectedTagIds([])
      setLoading(false)
      return
    }

    setTags(tagData || [])

    if (!personId) {
      setSelectedTagIds([])
      setLoading(false)
      return
    }

    const { data: selectedData, error: selectedError } = await supabase
      .from("person_tags")
      .select("tag_id")
      .eq("person_id", personId)

    if (selectedError) {
      console.error("Error loading person tags:", selectedError)
      setSelectedTagIds([])
    } else {
      setSelectedTagIds((selectedData || []).map((row) => row.tag_id))
    }

    setLoading(false)
  }, [personId, supabase])

  React.useEffect(() => {
    loadTags()
  }, [loadTags])

  async function toggleTag(tagId: string) {
    const isSelected = selectedTagIds.includes(tagId)

    setSavingTagId(tagId)

    try {
      if (isSelected) {
        await removePersonTag(contactId, tagId)
        setSelectedTagIds((current) => current.filter((id) => id !== tagId))
      } else {
        await addPersonTag(contactId, tagId)
        setSelectedTagIds((current) => [...current, tagId])
      }
    } finally {
      setSavingTagId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Discount Tags</CardTitle>
        </div>
        <CardDescription>
          Assign eligibility tags such as Staff, Member, Volunteer, or Scholarship.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tags...
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active discount tags found. Create tags under {PEOPLE_MANAGEMENT_MODULE_LABEL} → Discount Policies.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id)
              const isSaving = savingTagId === tag.id

              return (
                <Button
                  key={tag.id}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  disabled={isSaving}
                  onClick={() => toggleTag(tag.id)}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  {tag.name}
                </Button>
              )
            })}
          </div>
        )}

        {selectedTagIds.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags
              .filter((tag) => selectedTagIds.includes(tag.id))
              .map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

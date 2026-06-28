"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ContactRoleValue } from "@/lib/contacts/contact-constants"
import { matchDiscountTagsForRoles } from "@/lib/contacts/contact-discount-tag-mapping"
import { CONTACTS_MODULE_LABEL } from "@/lib/contacts/contact-module-label"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Tags } from "lucide-react"

type DiscountTag = {
  id: string
  name: string
  description: string | null
  active: boolean
}

type PersonTagsCardProps = {
  roles: ContactRoleValue[]
}

export function PersonTagsCard({ roles }: PersonTagsCardProps) {
  const supabase = React.useMemo(() => createClient(), [])

  const [loading, setLoading] = React.useState(true)
  const [tags, setTags] = React.useState<DiscountTag[]>([])

  React.useEffect(() => {
    let cancelled = false

    async function loadTags() {
      setLoading(true)

      const { data: tagData, error: tagError } = await supabase
        .from("discount_tags")
        .select("id, name, description, active")
        .eq("active", true)
        .order("name", { ascending: true })

      if (cancelled) return

      if (tagError) {
        console.error("Error loading discount tags:", tagError)
        setTags([])
      } else {
        setTags(tagData || [])
      }

      setLoading(false)
    }

    void loadTags()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const appliedTags = React.useMemo(
    () => matchDiscountTagsForRoles(roles, tags),
    [roles, tags]
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Discount Tags</CardTitle>
        </div>
        <CardDescription>
          Applied automatically from contact roles and activity (Staff, Member, Volunteer, Donor,
          etc.).
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
            No active discount tags found. Create tags under {CONTACTS_MODULE_LABEL} → Settings →
            Discount Tags.
          </p>
        ) : appliedTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No discount tags apply yet. Tags appear when matching roles are earned from activity.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {appliedTags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

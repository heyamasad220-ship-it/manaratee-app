import { format, parseISO } from "date-fns"
import { Mail, Phone } from "lucide-react"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import {
  resolveCustomerDisplayName,
  resolveCustomerInitials,
} from "@/lib/customer/customer-display-name"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

function formatMemberSince(value: string | null | undefined) {
  if (!value) return "—"

  try {
    return format(parseISO(value), "MMMM yyyy")
  } catch {
    return "—"
  }
}

export async function CustomerWelcomeHeader() {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return null
  }

  const user = session.authenticatedUser

  const { data: contact } = await supabase
    .from("contacts")
    .select("full_name, email, phone, created_at")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", activeOrganization.organization_id)
    .maybeSingle()

  const displayEmail = contact?.email || user.email || null
  const displayPhone = contact?.phone?.trim() || null
  const fullName = resolveCustomerDisplayName(contact?.full_name, displayEmail)
  const initials = resolveCustomerInitials(fullName, displayEmail)
  const memberSince = formatMemberSince(contact?.created_at as string | null | undefined)

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-5">
        <Avatar className="size-20 border-2 border-border">
          <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {fullName}
            </h1>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              Active Member
            </Badge>
            <span className="text-xs text-muted-foreground">Member since {memberSince}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayEmail || "—"}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{displayPhone || "—"}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

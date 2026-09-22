import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Mail, Pencil } from "lucide-react"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import {
  resolveCustomerDisplayName,
  resolveCustomerFirstName,
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
    .select("full_name, email, created_at")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", activeOrganization.organization_id)
    .maybeSingle()

  const displayEmail = contact?.email || user.email || null
  const fullName = resolveCustomerDisplayName(contact?.full_name, displayEmail)
  const firstName = resolveCustomerFirstName(contact?.full_name, displayEmail)
  const initials = resolveCustomerInitials(fullName, displayEmail)
  const memberSince = formatMemberSince(contact?.created_at as string | null | undefined)

  return (
    <section className="rounded-2xl border bg-card px-4 py-3 shadow-sm sm:px-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <Avatar className="size-12 border border-border sm:size-14">
          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary sm:text-base">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Welcome, {firstName}
            </h1>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              Active Member
            </Badge>
            <Link
              href="/customer/profile"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline sm:ml-auto"
            >
              <Pencil className="h-3 w-3" />
              Edit Profile
            </Link>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{displayEmail || "—"}</span>
            </span>
            <span>Member since {memberSince}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

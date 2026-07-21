"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  Heart,
  Loader2,
  Pencil,
  Users,
} from "lucide-react"

import { ContactGroupMembersPanel } from "@/components/contacts/contact-group-members-panel"
import { DonationGroupActivityPanel } from "@/components/donations/donation-group-activity-panel"
import { DonationGroupEditForm } from "@/components/donations/donation-group-edit-form"
import { DonationGroupFinancialPanel } from "@/components/donations/donation-group-financial-panel"
import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mapStatus, STATUS_COLORS } from "@/lib/contacts/contact-constants"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { findDepartmentForGivingGroupAction } from "@/lib/departments/department-giving-link"
import {
  departmentGroupWorkspaceHref,
  donationGroupGivingListHref,
  donationGroupHref,
  mapDonationTabToWorkspaceTab,
} from "@/lib/donations/donation-group-path"
import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import {
  getGivingGroupKindLabel,
  normalizeGivingGroupKind,
} from "@/lib/donations/giving-group-kind"
import { membershipTeamDetailPath } from "@/lib/memberships/membership-module-label"
import {
  isSafeReturnToPath,
  RETURN_TO_QUERY_PARAM,
} from "@/lib/navigation/return-to"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type DonationGroupDetailClientProps = {
  groupId: string
}

type GroupTab = "members" | "financial" | "activity"

type GroupRecord = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  status: string | null
  contact_type: string | null
  notes: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  primary_contact_name: string | null
  giving_group_kind?: string | null
  linked_hr_team_id?: string | null
  linked_department_id?: string | null
}

function parseGroupTab(value: string | null): GroupTab {
  if (value === "financial" || value === "group-giving") return "financial"
  if (value === "activity") return "activity"
  return "members"
}

export function DonationGroupDetailClient({ groupId }: DonationGroupDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [group, setGroup] = useState<GroupRecord | null>(null)
  const [linkedTeamName, setLinkedTeamName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const returnTo = searchParams.get(RETURN_TO_QUERY_PARAM)
  const backHref = donationGroupGivingListHref(
    returnTo && isSafeReturnToPath(returnTo) ? returnTo : DONATIONS_GROUP_GIVING_REPORT_PATH
  )

  const activeTab = parseGroupTab(searchParams.get("tab"))

  const loadGroup = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")
    setLinkedTeamName(null)
    setRedirecting(false)

    const orgId = await getCurrentOrganizationId()
    if (!orgId) {
      setGroup(null)
      setErrorMessage("No organization selected.")
      setLoading(false)
      return
    }

    // If this giving group is a Department (linked or same name), use the shared workspace.
    const departmentPair = await findDepartmentForGivingGroupAction(groupId)
    if (departmentPair.success && departmentPair.pair) {
      setRedirecting(true)
      const workspaceTab = mapDonationTabToWorkspaceTab(searchParams.get("tab"))
      const href = departmentGroupWorkspaceHref(departmentPair.pair.departmentId, {
        tab: workspaceTab,
        returnTo:
          returnTo && isSafeReturnToPath(returnTo)
            ? returnTo
            : DONATIONS_GROUP_GIVING_REPORT_PATH,
      })
      const withFrom = href.includes("?")
        ? `${href}&from=donations`
        : `${href}?from=donations`
      router.replace(withFrom)
      return
    }

    const selectWithCategory =
      "id, full_name, email, phone, status, contact_type, notes, address, city, state, zip, primary_contact_name, giving_group_kind, linked_hr_team_id, linked_department_id"
    const selectBasic =
      "id, full_name, email, phone, status, contact_type, notes, address, city, state, zip, primary_contact_name"

    let data: GroupRecord | null = null
    const withCategory = await supabase
      .from("contacts")
      .select(selectWithCategory)
      .eq("organization_id", orgId)
      .eq("id", groupId)
      .maybeSingle()

    if (withCategory.error) {
      const basic = await supabase
        .from("contacts")
        .select(selectBasic)
        .eq("organization_id", orgId)
        .eq("id", groupId)
        .maybeSingle()
      if (basic.error || !basic.data) {
        setGroup(null)
        setErrorMessage(
          basic.error?.message ||
            withCategory.error.message ||
            "This group could not be found."
        )
        setLoading(false)
        return
      }
      data = {
        ...(basic.data as GroupRecord),
        giving_group_kind: "group_donation",
        linked_hr_team_id: null,
        linked_department_id: null,
      }
    } else if (!withCategory.data) {
      setGroup(null)
      setErrorMessage("This group could not be found.")
      setLoading(false)
      return
    } else {
      data = withCategory.data as GroupRecord
    }

    if (data.contact_type !== "group") {
      router.replace(`/contacts/${groupId}`)
      return
    }

    setGroup(data)

    const kind = normalizeGivingGroupKind(data.giving_group_kind)
    if (kind === "membership_group" && data.linked_hr_team_id) {
      const { data: team } = await supabase
        .from("hr_teams")
        .select("name")
        .eq("organization_id", orgId)
        .eq("id", data.linked_hr_team_id)
        .maybeSingle()
      setLinkedTeamName((team?.name as string | null) ?? null)
    }

    setLoading(false)
  }, [groupId, returnTo, router, searchParams, supabase])

  useEffect(() => {
    void loadGroup()
  }, [loadGroup])

  function handleTabChange(tab: string) {
    const next = parseGroupTab(tab)
    router.replace(
      donationGroupHref(groupId, {
        tab: next,
        returnTo: returnTo && isSafeReturnToPath(returnTo) ? returnTo : undefined,
      }),
      { scroll: false }
    )
  }

  if (loading || redirecting) {
    return (
      <>
        <Header title="Group" />
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {redirecting ? "Opening department workspace..." : "Loading group..."}
        </div>
      </>
    )
  }

  if (!group) {
    return (
      <>
        <Header title="Group Not Found" />
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {errorMessage || "This group could not be found."}
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href={backHref}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Group Giving
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const displayName = group.full_name || "Group"
  const mappedStatus = mapStatus(group.status)
  const kind = normalizeGivingGroupKind(group.giving_group_kind)
  const kindLabel = getGivingGroupKindLabel(kind)
  const linkedHref =
    kind === "membership_group" && group.linked_hr_team_id
      ? membershipTeamDetailPath(group.linked_hr_team_id)
      : null

  return (
    <>
      <Header title={displayName} />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
              <Link href={backHref}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Group Giving
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold tracking-tight">{displayName}</h1>
              <Badge variant="secondary" className={cn("font-normal", STATUS_COLORS[mappedStatus])}>
                {mappedStatus}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {kindLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Workspace for members, campaign group giving, and activity for this group.
              {linkedHref && linkedTeamName ? (
                <>
                  {" "}
                  Linked to{" "}
                  <Link href={linkedHref} className="text-primary hover:underline">
                    {linkedTeamName}
                  </Link>
                  .
                </>
              ) : null}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit group
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="members" className="gap-2">
              <Users className="size-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <Heart className="size-4" />
              Group giving
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <CalendarDays className="size-4" />
              Activity
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "members" ? (
          <ContactGroupMembersPanel
            groupContactId={group.id}
            groupName={displayName}
          />
        ) : null}

        {activeTab === "financial" ? (
          <DonationGroupFinancialPanel
            groupContactId={group.id}
            groupName={displayName}
            refreshToken={refreshToken}
          />
        ) : null}

        {activeTab === "activity" ? (
          <DonationGroupActivityPanel
            groupContactId={group.id}
            departmentId={group.linked_department_id}
            refreshToken={refreshToken}
          />
        ) : null}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
          </DialogHeader>
          <DonationGroupEditForm
            group={group}
            onCancel={() => setEditOpen(false)}
            onSaved={async () => {
              setEditOpen(false)
              await loadGroup()
              setRefreshToken((current) => current + 1)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

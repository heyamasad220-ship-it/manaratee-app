"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import {
  formatDonationCurrency,
} from "@/lib/donations/campaign-analytics"
import { getCampaignAnalyticsAction } from "@/lib/donations/donation-reports-actions"
import { createClient } from "@/lib/supabase/client"

type CampaignStatus = "Active" | "Completed" | "Draft" | "Paused"

interface CampaignRow {
  id: string
  name: string
  description: string
  goalAmount: number
  raisedAmount: number
  startDate: string
  endDate: string
  status: CampaignStatus
}

function mapCampaignStatus(status?: string | null): CampaignStatus {
  switch (status?.toLowerCase()) {
    case "active":
      return "Active"
    case "completed":
      return "Completed"
    case "paused":
      return "Paused"
    default:
      return "Draft"
  }
}

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  switch (status) {
    case "Active":
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          Active
        </span>
      )
    case "Completed":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          Completed
        </span>
      )
    case "Paused":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          Paused
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          Draft
        </span>
      )
  }
}

function generateCampaignCode(campaignName: string) {
  const words = campaignName.trim().split(/\s+/)
  const codePrefix = words.map((word) => word.charAt(0).toUpperCase()).join("")
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${codePrefix}${randomSuffix}`
}

export function DonationCampaignsOverviewTable({ canManage }: { canManage: boolean }) {
  const supabase = createClient()
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showCampaignDialog, setShowCampaignDialog] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<CampaignRow | null>(null)
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    goalAmount: "",
    startDate: "",
    endDate: "",
    status: "Draft" as CampaignStatus,
  })

  async function getOrganizationId() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (error) {
      console.error("Error loading organization:", error)
      return null
    }

    return data?.organization_id || null
  }

  async function loadCampaigns() {
    setLoading(true)
    setErrorMessage(null)

    const result = await getCampaignAnalyticsAction()
    if (!result.success) {
      setErrorMessage(result.error)
      setCampaigns([])
      setLoading(false)
      return
    }

    setCampaigns(
      (result.entries || []).map(({ campaign, metrics }) => ({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description || "",
        goalAmount: Number(campaign.goal_amount || 0),
        raisedAmount: metrics.raised,
        startDate: campaign.start_date || "",
        endDate: campaign.end_date || "",
        status: mapCampaignStatus(campaign.status),
      }))
    )
    setLoading(false)
  }

  useEffect(() => {
    void loadCampaigns()
  }, [])

  useEffect(() => {
    if (editingCampaign) {
      setCampaignForm({
        name: editingCampaign.name,
        description: editingCampaign.description,
        goalAmount: editingCampaign.goalAmount.toString(),
        startDate: editingCampaign.startDate,
        endDate: editingCampaign.endDate,
        status: editingCampaign.status,
      })
      return
    }

    setCampaignForm({
      name: "",
      description: "",
      goalAmount: "",
      startDate: "",
      endDate: "",
      status: "Draft",
    })
  }, [editingCampaign])

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0
      return bTime - aTime
    })
  }, [campaigns])

  async function handleSaveCampaign() {
    const orgId = await getOrganizationId()

    if (!orgId) {
      alert("No organization selected")
      return
    }

    if (!campaignForm.name.trim()) {
      alert("Campaign name is required")
      return
    }

    const existingCampaign = campaigns.find(
      (campaign) =>
        campaign.name.toLowerCase() === campaignForm.name.trim().toLowerCase() &&
        (!editingCampaign || campaign.id !== editingCampaign.id)
    )

    if (existingCampaign) {
      alert("A campaign with this name already exists")
      return
    }

    const campaignData = {
      organization_id: orgId,
      name: campaignForm.name.trim(),
      description: campaignForm.description.trim() || null,
      goal_amount: campaignForm.goalAmount ? Number(campaignForm.goalAmount) : null,
      start_date: campaignForm.startDate || null,
      end_date: campaignForm.endDate || null,
      status: campaignForm.status.toLowerCase(),
    }

    if (editingCampaign) {
      const { error } = await supabase
        .from("campaigns")
        .update(campaignData)
        .eq("id", editingCampaign.id)

      if (error) {
        console.error("Error updating campaign:", error)
        alert(error.message)
        return
      }
    } else {
      const { error } = await supabase.from("campaigns").insert({
        ...campaignData,
        code: generateCampaignCode(campaignForm.name.trim()),
      })

      if (error) {
        console.error("Error saving campaign:", error)
        alert(error.message)
        return
      }
    }

    setShowCampaignDialog(false)
    setEditingCampaign(null)
    await loadCampaigns()
  }

  async function handleDeleteCampaign(campaignId: string) {
    if (!confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) {
      return
    }

    const { error } = await supabase.from("campaigns").delete().eq("id", campaignId)

    if (error) {
      console.error("Error deleting campaign:", error)
      alert(error.message)
      return
    }

    await loadCampaigns()
  }

  function openCreateDialog() {
    setEditingCampaign(null)
    setShowCampaignDialog(true)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Donation Campaigns</h3>
            <p className="text-sm text-muted-foreground">Create and manage fundraising campaigns</p>
            {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
          </div>
          {canManage ? (
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Campaign
            </Button>
          ) : null}
        </div>

        <Card className="border border-border shadow-sm">
          <CardHeader className="sr-only">
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>All campaigns, most recent first</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead className="w-[100px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 6 : 5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {loading ? "Loading campaigns..." : "No campaigns yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCampaigns.map((campaign) => {
                    const progressPercent =
                      campaign.goalAmount > 0
                        ? Math.round((campaign.raisedAmount / campaign.goalAmount) * 100)
                        : 0

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <Link
                              href={`/donations/campaigns/${campaign.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {campaign.name}
                            </Link>
                            {campaign.description ? (
                              <p className="text-sm text-muted-foreground">{campaign.description}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatDonationCurrency(campaign.goalAmount)}
                        </TableCell>
                        <TableCell className="font-medium text-emerald-600">
                          {formatDonationCurrency(campaign.raisedAmount)}
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <CampaignProgressBar progressPercent={progressPercent} />
                        </TableCell>
                        <TableCell>
                          <CampaignStatusBadge status={campaign.status} />
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingCampaign(campaign)
                                  setShowCampaignDialog(true)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                onClick={() => void handleDeleteCampaign(campaign.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {canManage ? (
        <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCampaign ? "Edit Campaign" : "Add Campaign"}</DialogTitle>
              <DialogDescription>
                {editingCampaign ? "Update campaign details" : "Create a new fundraising campaign"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-name">Campaign Name</Label>
                <Input
                  id="camp-name"
                  placeholder="e.g., Building Fund 2025"
                  value={campaignForm.name}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-description">Description</Label>
                <Textarea
                  id="camp-description"
                  placeholder="Brief description of this campaign"
                  rows={2}
                  value={campaignForm.description}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-goal">Goal Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="camp-goal"
                    type="number"
                    placeholder="50000"
                    className="pl-7"
                    value={campaignForm.goalAmount}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({ ...prev, goalAmount: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="camp-start">Start Date</Label>
                  <Input
                    id="camp-start"
                    type="date"
                    value={campaignForm.startDate}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="camp-end">End Date</Label>
                  <Input
                    id="camp-end"
                    type="date"
                    value={campaignForm.endDate}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({ ...prev, endDate: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="camp-status">Status</Label>
                <Select
                  value={campaignForm.status}
                  onValueChange={(value: CampaignStatus) =>
                    setCampaignForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger id="camp-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSaveCampaign()}>
                {editingCampaign ? "Save Changes" : "Add Campaign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

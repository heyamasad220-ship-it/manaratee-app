"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowUpDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PledgeDonorSubline } from "@/components/donations/pledge-donor-subline";
import { ContactProfileDialog } from "@/components/contacts/contact-profile-dialog";
import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog";
import {
  PledgeSummaryMetricCards,
  type PledgeSummaryMetrics,
} from "@/components/donations/pledge-summary-metric-cards";
import { formatPledgeReminderStatusLabel } from "@/lib/donations/pledge-reminder-types";
import { pledgeDisplayStatus, type PledgeDisplayStatus } from "@/lib/donations/donation-status";
import {
  fetchPledgesPageAction,
  fetchPledgeSummaryMetricsAction,
} from "@/lib/donations/donation-list-actions";
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination";
import {
  attachPledgeDonorContext,
  emptyPledgeDonorContext,
  type PledgeMemberGroup,
} from "@/lib/donations/pledge-donor-context";
import { DONATION_PLEDGES_PATH } from "@/lib/donations/donation-pledge-paths";
import type { ContactRecordType } from "@/lib/contacts/contact-constants";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter";

interface Pledge {
  id: string;
  donorId: string | null;
  contactId: string | null;
  donorName: string;
  contactType: ContactRecordType | null;
  primaryContactName: string | null;
  memberGroups: PledgeMemberGroup[];
  amount_pledged: number;
  amount_paid: number;
  balance_remaining: number;
  frequency: string;
  startDate: string;
  nextPayment: string | null;
  installmentAmount: number | null;
  totalPayments: number | null;
  firstPaymentDate: string | null;
  status: PledgeDisplayStatus;
  campaignName: string;
  campaignId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  wishlistItemId: string | null;
  notes?: string;
  lastReminderAt: string | null;
  lastReminderStatus: string | null;
  lastContactedAt: string | null;
}

type CampaignOption = {
  id: string;
  name: string;
};

function normalizeDateInput(date?: string | null) {
  if (!date) return null;
  return date.slice(0, 10);
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function attachReminderSummaries(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  mapped: Pledge[]
) {
  const pledgeIds = mapped.map((pledge) => pledge.id);
  if (pledgeIds.length === 0) return mapped;

  const { data } = await supabase
    .from("pledge_reminders")
    .select("pledge_id, status, reminder_type, sent_at, created_at")
    .eq("organization_id", orgId)
    .in("pledge_id", pledgeIds)
    .order("created_at", { ascending: false });

  const summaryByPledge = new Map<
    string,
    {
      lastReminderAt: string | null;
      lastReminderStatus: string | null;
      lastContactedAt: string | null;
    }
  >();

  for (const row of data || []) {
    const pledgeId = row.pledge_id as string;
    const existing = summaryByPledge.get(pledgeId) || {
      lastReminderAt: null,
      lastReminderStatus: null,
      lastContactedAt: null,
    };

    if (row.reminder_type === "contacted" && !existing.lastContactedAt) {
      existing.lastContactedAt = (row.sent_at || row.created_at) as string;
    }

    if (row.reminder_type !== "contacted" && !existing.lastReminderAt) {
      existing.lastReminderAt = (row.sent_at || row.created_at) as string;
      existing.lastReminderStatus = row.status as string;
    }

    summaryByPledge.set(pledgeId, existing);
  }

  return mapped.map((pledge) => {
    const summary = summaryByPledge.get(pledge.id);
    return {
      ...pledge,
      lastReminderAt: summary?.lastReminderAt ?? null,
      lastReminderStatus: summary?.lastReminderStatus ?? null,
      lastContactedAt: summary?.lastContactedAt ?? null,
    };
  });
}

function pledgeFromRow(row: any): Pledge {
  const amountPledged = Number(row.amount_pledged || 0);
  const amountPaid = Number(row.amount_paid || 0);

  return {
    id: row.id,
    donorId: row.donor_id || null,
    contactId: row.contact_id || null,
    donorName: row.donor_name || "Unknown donor",
    ...emptyPledgeDonorContext(),
    amount_pledged: amountPledged,
    amount_paid: amountPaid,
    balance_remaining: Number(row.balance_remaining ?? Math.max(amountPledged - amountPaid, 0)),
    frequency: row.frequency || "One-Time",
    startDate: normalizeDateInput(row.pledge_date) || "",
    nextPayment: normalizeDateInput(row.next_payment_date) || null,
    installmentAmount: row.installment_amount == null ? null : Number(row.installment_amount),
    totalPayments: row.total_payments == null ? null : Number(row.total_payments),
    firstPaymentDate: normalizeDateInput(row.first_payment_date) || null,
    status: pledgeDisplayStatus(row.calculated_status, amountPledged, amountPaid),
    campaignName: row.campaign_name || "Unassigned",
    campaignId: row.campaign_id || null,
    categoryId: null,
    subcategoryId: null,
    wishlistItemId: null,
    notes: row.notes || undefined,
    lastReminderAt: null,
    lastReminderStatus: null,
    lastContactedAt: null,
  };
}

export default function PledgesPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [donorNameFilter, setDonorNameFilter] = useState("");
  const [donorNameFilterInput, setDonorNameFilterInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPledges, setTotalPledges] = useState(0);
  const [summaryMetrics, setSummaryMetrics] = useState<PledgeSummaryMetrics>({
    totalPledged: 0,
    totalCollected: 0,
    outstandingBalance: 0,
    activePledgeCount: 0,
    pledgeCount: 0,
  });
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [contactProfileId, setContactProfileId] = useState<string | null>(null);
  const [showContactProfile, setShowContactProfile] = useState(false);
  const [handledPledgeQuery, setHandledPledgeQuery] = useState<string | null>(null);
  const [handledAddQuery, setHandledAddQuery] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPledgeId, setDetailsPledgeId] = useState<string | null>(null);
  const [detailsProspectId, setDetailsProspectId] = useState<string | null>(null);
  const [detailsCampaignId, setDetailsCampaignId] = useState<string | null>(null);
  const [detailsContactId, setDetailsContactId] = useState<string | null>(null);

  async function openContactProfile(pledge: Pledge) {
    let contactId = pledge.contactId;

    if (!contactId && pledge.donorId) {
      const orgId = organizationId || (await getOrgIdForCurrentUser());
      if (orgId) {
        const { data: donorRow } = await supabase
          .from("donors")
          .select("contact_id")
          .eq("id", pledge.donorId)
          .eq("organization_id", orgId)
          .maybeSingle();

        contactId = (donorRow?.contact_id as string | null) ?? null;
      }
    }

    if (!contactId) {
      alert("No contact profile is linked to this donor yet.");
      return;
    }

    setContactProfileId(contactId);
    setShowContactProfile(true);
  }

  async function getOrgIdForCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (error || !profile?.organization_id) return null;

    if (!["super_admin", "admin"].includes(profile.role || "")) return null;

    return profile.organization_id as string;
  }

  async function loadCampaignOptions(orgId: string) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (error) {
      console.warn("Could not load campaigns table.", error);
      setCampaignOptions([]);
      return;
    }

    setCampaignOptions(
      (data || [])
        .filter((campaign: { name?: string | null }) => campaign.name)
        .map((campaign: { id: string; name: string }) => ({
          id: String(campaign.id),
          name: String(campaign.name),
        }))
    );
  }

  const fetchPledges = async (nextPage = page) => {
    setLoading(true);

    const orgId = await getOrgIdForCurrentUser();

    if (!orgId) {
      setOrganizationId(null);
      setPledges([]);
      setCampaignOptions([]);
      setLoading(false);
      return;
    }

    setOrganizationId(orgId);
    await loadCampaignOptions(orgId);

    const statusMap: Record<string, string> = {
      Open: "open",
      Partial: "partial",
      Fulfilled: "fulfilled",
    };

    const pageResult = await fetchPledgesPageAction({
      page: nextPage,
      pageSize: DONATIONS_PAGE_SIZE,
      search: donorNameFilter || undefined,
      status: statusFilter === "all" ? undefined : statusMap[statusFilter],
      campaignId: campaignFilter === "all" ? undefined : campaignFilter,
    });

    const metricsResult = await fetchPledgeSummaryMetricsAction({
      search: donorNameFilter || undefined,
      status: statusFilter === "all" ? undefined : statusMap[statusFilter],
      campaignId: campaignFilter === "all" ? undefined : campaignFilter,
    });

    if (!pageResult.success) {
      console.error("Error loading donation pledges:", pageResult.error);
      setPledges([]);
      setLoading(false);
      return;
    }

    if (metricsResult.success) {
      setSummaryMetrics(metricsResult.metrics);
    }

    setTotalPledges(pageResult.total);
    setPage(pageResult.page);

    const mapped = (pageResult.pledges || [])
      .filter((row: any) => String(row.calculated_status || "").toLowerCase() !== "cancelled")
      .map(pledgeFromRow);

    const donorIds = Array.from(
      new Set(mapped.map((pledge) => pledge.donorId).filter(Boolean))
    ) as string[];

    if (donorIds.length > 0) {
      const { data: donorRows } = await supabase
        .from("donors")
        .select("id, contact_id")
        .eq("organization_id", orgId)
        .in("id", donorIds);

      const contactByDonor = new Map(
        (donorRows || []).map((row: any) => [row.id as string, row.contact_id as string | null])
      );

      for (const pledge of mapped) {
        if (!pledge.contactId && pledge.donorId) {
          pledge.contactId = contactByDonor.get(pledge.donorId) ?? null;
        }
      }
    }

    const pledgeIds = mapped.map((pledge) => pledge.id);
    if (pledgeIds.length > 0) {
      const { data: attributionRows } = await supabase
        .from("pledges")
        .select("id, campaign_id, category_id, subcategory_id")
        .eq("organization_id", orgId)
        .in("id", pledgeIds);

      const attributionById = new Map(
        (attributionRows || []).map((row: any) => [row.id as string, row])
      );

      for (const pledge of mapped) {
        const attribution = attributionById.get(pledge.id);
        if (!attribution) continue;
        pledge.campaignId = (attribution.campaign_id as string | null) ?? pledge.campaignId;
        pledge.categoryId = (attribution.category_id as string | null) ?? null;
        pledge.subcategoryId = (attribution.subcategory_id as string | null) ?? null;
      }
    }

    setPledges(
      await attachPledgeDonorContext(
        supabase,
        orgId,
        await attachReminderSummaries(supabase, orgId, mapped)
      )
    );
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDonorNameFilter(donorNameFilterInput), 300);
    return () => clearTimeout(timer);
  }, [donorNameFilterInput]);

  useEffect(() => {
    setPage(1);
  }, [donorNameFilter, statusFilter, campaignFilter]);

  useEffect(() => {
    fetchPledges(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donorNameFilter, statusFilter, campaignFilter, page]);

  useEffect(() => {
    if (window.location.hash === "#collection-queue") {
      document.getElementById("collection-queue")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading]);

  useEffect(() => {
    const campaignId = searchParams.get("campaignId");
    const action = searchParams.get("action");
    if (!campaignId || action === "add") return;

    setCampaignFilter(campaignId);
  }, [searchParams]);

  useEffect(() => {
    const pledgeId = searchParams.get("pledgeId");
    const action = searchParams.get("action");
    const prospectId = searchParams.get("prospectId");
    const campaignId = searchParams.get("campaignId");
    const contactId = searchParams.get("contactId");
    const queryKey = `${pledgeId || ""}:${action || ""}:${prospectId || ""}:${contactId || ""}`;

    if (pledgeId) {
      if (handledPledgeQuery === queryKey) return;
      setDetailsPledgeId(pledgeId);
      setDetailsProspectId(null);
      setDetailsCampaignId(null);
      setDetailsContactId(null);
      setDetailsOpen(true);
      setHandledPledgeQuery(queryKey);
      router.replace(DONATION_PLEDGES_PATH, { scroll: false });
      return;
    }

    if (action !== "add" || handledAddQuery) return;

    if (campaignId) setCampaignFilter(campaignId);
    setDetailsPledgeId(null);
    setDetailsProspectId(prospectId);
    setDetailsCampaignId(campaignId);
    setDetailsContactId(contactId);
    setDetailsOpen(true);
    setHandledAddQuery(true);
    router.replace(DONATION_PLEDGES_PATH, { scroll: false });
  }, [searchParams, handledPledgeQuery, handledAddQuery, router]);

  function openAddPledge() {
    setDetailsPledgeId(null);
    setDetailsProspectId(null);
    setDetailsContactId(null);
    setDetailsCampaignId(
      campaignFilter !== "all" && campaignFilter !== "__none__" ? campaignFilter : null
    );
    setDetailsOpen(true);
  }

  function openPledge(pledgeId: string) {
    setDetailsPledgeId(pledgeId);
    setDetailsProspectId(null);
    setDetailsContactId(null);
    setDetailsCampaignId(null);
    setDetailsOpen(true);
  }

  function closeDetails(open: boolean) {
    setDetailsOpen(open);
    if (!open) {
      setDetailsPledgeId(null);
      setDetailsProspectId(null);
      setDetailsCampaignId(null);
      setDetailsContactId(null);
    }
  }

  const getStatusBadge = (status: PledgeDisplayStatus) => {
    switch (status) {
      case "Open":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Open</Badge>;
      case "Partial":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Partial</Badge>;
      case "Fulfilled":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Fulfilled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="p-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={openAddPledge}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pledge
          </Button>
        </div>

        <PledgeSummaryMetricCards
          metrics={summaryMetrics}
          statusFilter={statusFilter}
          className="mb-6"
        />

        <Card id="collection-queue" className="scroll-mt-6">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Donor Name"
                      active={Boolean(donorNameFilter.trim())}
                      trailing={
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-medium hover:bg-transparent"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                      }
                    >
                      {({ close }) => (
                        <Input
                          placeholder="Search by name"
                          value={donorNameFilterInput}
                          onChange={(event) => setDonorNameFilterInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setDonorNameFilter(donorNameFilterInput);
                              close();
                            }
                          }}
                        />
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead>Amount Pledged</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Status"
                      active={statusFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={statusFilter}
                          onValueChange={(value) => {
                            setStatusFilter(value);
                            close();
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="Partial">Partial</SelectItem>
                            <SelectItem value="Fulfilled">Fulfilled</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Campaign"
                      active={campaignFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={campaignFilter}
                          onValueChange={(value) => {
                            setCampaignFilter(value);
                            close();
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Campaign" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Campaigns</SelectItem>
                            <SelectItem value="__none__">Unassigned</SelectItem>
                            {campaignOptions.map((campaign) => (
                              <SelectItem key={campaign.id} value={campaign.id}>
                                {campaign.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead>Last Reminder</TableHead>
                  <TableHead>Last Contacted</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Loading pledges...
                    </TableCell>
                  </TableRow>
                ) : pledges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No pledges found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pledges.map((pledge) => (
                    <TableRow
                      key={pledge.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openPledge(pledge.id)}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <div>
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => void openContactProfile(pledge)}
                          >
                            {pledge.donorName}
                          </button>
                          <PledgeDonorSubline
                            contactType={pledge.contactType}
                            primaryContactName={pledge.primaryContactName}
                            memberGroups={pledge.memberGroups}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        {formatCurrency(pledge.amount_pledged)}
                      </TableCell>

                      <TableCell className="font-medium text-emerald-600">
                        {formatCurrency(pledge.amount_paid)}
                      </TableCell>

                      <TableCell
                        className={
                          pledge.balance_remaining > 0
                            ? "font-medium text-amber-600"
                            : "text-muted-foreground"
                        }
                      >
                        {formatCurrency(pledge.balance_remaining)}
                      </TableCell>

                      <TableCell>{getStatusBadge(pledge.status)}</TableCell>

                      <TableCell>
                        <Badge variant="outline">{pledge.campaignName}</Badge>
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {pledge.lastReminderAt ? (
                          <div>
                            <div>{formatPledgeReminderStatusLabel(pledge.lastReminderStatus)}</div>
                            <div className="text-xs">{formatDisplayDate(pledge.lastReminderAt)}</div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell>{formatDisplayDate(pledge.lastContactedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {Math.ceil(totalPledges / DONATIONS_PAGE_SIZE) > 1 ? (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setPage((current) => Math.max(1, current - 1));
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  {page} / {Math.ceil(totalPledges / DONATIONS_PAGE_SIZE)}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setPage((current) =>
                      Math.min(Math.ceil(totalPledges / DONATIONS_PAGE_SIZE), current + 1)
                    );
                  }}
                  className={
                    page >= Math.ceil(totalPledges / DONATIONS_PAGE_SIZE)
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </div>

      <PledgeDetailsDialog
        open={detailsOpen}
        onOpenChange={closeDetails}
        pledgeId={detailsPledgeId}
        organizationId={organizationId}
        defaultCampaignId={detailsCampaignId}
        defaultContactId={detailsContactId}
        prospectId={detailsProspectId}
        onSaved={() => {
          setDetailsProspectId(null);
          void fetchPledges();
        }}
        onDeleted={() => {
          closeDetails(false);
          void fetchPledges();
        }}
      />

      <ContactProfileDialog
        contactId={contactProfileId}
        open={showContactProfile}
        onOpenChange={setShowContactProfile}
        onContactUpdated={() => void fetchPledges()}
      />
    </>
  );
}

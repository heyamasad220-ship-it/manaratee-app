"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Columns3, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PledgeDonorSubline } from "@/components/donations/pledge-donor-subline";
import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog";
import { PledgeOutreachDialog } from "@/components/donations/pledge-reminder-actions";
import {
  PledgeSummaryMetricCards,
  type PledgeSummaryMetrics,
} from "@/components/donations/pledge-summary-metric-cards";
import {
  applyContactedReminder,
  callTextReminderLines,
  formatPledgeReminderStatusLabel,
} from "@/lib/donations/pledge-reminder-types";
import { pledgeDisplayStatus, type PledgeDisplayStatus } from "@/lib/donations/donation-status";
import {
  fetchPledgesExportAction,
  fetchPledgesPageAction,
  fetchPledgeSummaryMetricsAction,
} from "@/lib/donations/donation-list-actions";
import { downloadPledgesReportExcel } from "@/lib/donations/pledge-report-csv";
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination";
import {
  attachPledgeDonorContext,
  emptyPledgeDonorContext,
  lookupDonorEmailPhone,
  type PledgeMemberGroup,
} from "@/lib/donations/pledge-donor-context";
import {
  defaultPledgeLedgerColumns,
  loadPledgeLedgerColumns,
  pledgeLedgerColumnOptions,
  savePledgeLedgerColumns,
  type PledgeLedgerColumnId,
} from "@/lib/donations/pledge-ledger-columns";
import { formatPhoneDisplayOrDash } from "@/lib/ui/format-phone";
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
  email: string | null;
  phone: string | null;
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
  lastCallAt: string | null;
  lastTextAt: string | null;
  contactNotes: string | null;
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
    .select("pledge_id, status, reminder_type, contact_method, sent_at, created_at, contact_notes")
    .eq("organization_id", orgId)
    .in("pledge_id", pledgeIds)
    .order("created_at", { ascending: false });

  const summaryByPledge = new Map<
    string,
    {
      lastReminderAt: string | null;
      lastReminderStatus: string | null;
      lastContactedAt: string | null;
      lastCallAt: string | null;
      lastTextAt: string | null;
      contactNotes: string | null;
      contactNotesAt: string | null;
    }
  >();

  for (const row of data || []) {
    const pledgeId = row.pledge_id as string;
    const existing = summaryByPledge.get(pledgeId) || {
      lastReminderAt: null,
      lastReminderStatus: null,
      lastContactedAt: null,
      lastCallAt: null,
      lastTextAt: null,
      contactNotes: null,
      contactNotesAt: null,
    };

    const contacted = {
      lastCallAt: existing.lastCallAt,
      lastTextAt: existing.lastTextAt,
      lastContactedAt: existing.lastContactedAt,
      contactNotes: existing.contactNotes,
      contactNotesAt: existing.contactNotesAt,
    };
    applyContactedReminder(contacted, row);
    existing.lastCallAt = contacted.lastCallAt;
    existing.lastTextAt = contacted.lastTextAt;
    existing.lastContactedAt = contacted.lastContactedAt;
    existing.contactNotes = contacted.contactNotes;
    existing.contactNotesAt = contacted.contactNotesAt;

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
      lastCallAt: summary?.lastCallAt ?? null,
      lastTextAt: summary?.lastTextAt ?? null,
      contactNotes: summary?.contactNotes ?? null,
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
    email: null,
    phone: null,
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
    lastCallAt: null,
    lastTextAt: null,
    contactNotes: null,
  };
}

export function PledgesLedger({
  lockedCampaignId,
  embedded = false,
}: {
  lockedCampaignId?: string;
  embedded?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [donorNameFilter, setDonorNameFilter] = useState("");
  const [donorNameFilterInput, setDonorNameFilterInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Open");
  const [campaignFilter, setCampaignFilter] = useState<string>(
    () => lockedCampaignId || searchParams.get("campaignId") || "all"
  );
  const pledgeFetchGeneration = useRef(0);
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
  const [exporting, setExporting] = useState(false);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [handledPledgeQuery, setHandledPledgeQuery] = useState<string | null>(null);
  const [handledAddQuery, setHandledAddQuery] = useState(false);

  const includeCampaignColumn = !lockedCampaignId;
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<PledgeLedgerColumnId[]>(() =>
    defaultPledgeLedgerColumns(includeCampaignColumn)
  );
  const visibleColumnSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPledgeId, setDetailsPledgeId] = useState<string | null>(null);
  const [outreachPledge, setOutreachPledge] = useState<{ id: string; donorName: string } | null>(
    null
  );
  const [detailsProspectId, setDetailsProspectId] = useState<string | null>(null);
  const [detailsCampaignId, setDetailsCampaignId] = useState<string | null>(null);
  const [detailsContactId, setDetailsContactId] = useState<string | null>(null);

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

  function pledgeListFilters() {
    const statusMap: Record<string, string> = {
      Open: "open",
      Fulfilled: "fulfilled",
    };
    const resolvedStatus = statusFilter === "Partial" ? "Open" : statusFilter;
    return {
      search: donorNameFilter || undefined,
      status: resolvedStatus === "all" ? undefined : statusMap[resolvedStatus],
      campaignId: campaignFilter === "all" ? undefined : campaignFilter,
    };
  }

  const fetchPledges = async (nextPage = page) => {
    const generation = ++pledgeFetchGeneration.current;
    setLoading(true);

    const orgId = await getOrgIdForCurrentUser();
    if (generation !== pledgeFetchGeneration.current) return;

    if (!orgId) {
      setOrganizationId(null);
      setPledges([]);
      setCampaignOptions([]);
      setLoading(false);
      return;
    }

    setOrganizationId(orgId);
    await loadCampaignOptions(orgId);

    const filters = pledgeListFilters();

    const [pageResult, metricsResult] = await Promise.all([
      fetchPledgesPageAction({
        page: nextPage,
        pageSize: DONATIONS_PAGE_SIZE,
        sortBy: "amount_pledged",
        sortAsc: false,
        ...filters,
      }),
      fetchPledgeSummaryMetricsAction(
        lockedCampaignId ? { campaignId: lockedCampaignId } : {}
      ),
    ]);

    if (generation !== pledgeFetchGeneration.current) return;

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

    const contactChannels = await lookupDonorEmailPhone(supabase, orgId, donorIds);
    for (const pledge of mapped) {
      const channel = pledge.donorId ? contactChannels.get(pledge.donorId) : undefined;
      pledge.email = channel?.email ?? null;
      pledge.phone = channel?.phone ?? null;
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
    setVisibleColumns(loadPledgeLedgerColumns(includeCampaignColumn));
  }, [includeCampaignColumn]);

  function applyVisibleColumns(next: PledgeLedgerColumnId[]) {
    const allowed = defaultPledgeLedgerColumns(includeCampaignColumn);
    const selected = new Set(next);
    selected.add("donor");
    const ordered = allowed.filter((id) => selected.has(id));
    setVisibleColumns(ordered);
    savePledgeLedgerColumns(ordered);
  }

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
    if (lockedCampaignId) {
      setCampaignFilter(lockedCampaignId);
      return;
    }
    const campaignId = searchParams.get("campaignId");
    const action = searchParams.get("action");
    if (!campaignId || action === "add") return;

    setCampaignFilter(campaignId);
  }, [searchParams, lockedCampaignId]);

  useEffect(() => {
    if (lockedCampaignId) return;
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
  }, [searchParams, handledPledgeQuery, handledAddQuery, router, lockedCampaignId]);

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

  async function handleExport() {
    setExporting(true);
    const result = await fetchPledgesExportAction(pledgeListFilters());
    setExporting(false);
    if (!result.success) {
      alert(result.error || "Could not export pledges.");
      return;
    }
    if (result.pledges.length === 0) {
      alert("No pledges to export for the current filters.");
      return;
    }
    downloadPledgesReportExcel(result.pledges, new Date().toISOString(), visibleColumns);
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
      case "Fulfilled":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Fulfilled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <div
        className={
          embedded
            ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
            : "flex h-full min-h-0 flex-1 flex-col overflow-hidden p-6"
        }
      >
        <div className="mb-4 flex shrink-0 justify-end gap-2">
          <Button variant="outline" onClick={() => setColumnsOpen(true)}>
            <Columns3 className="mr-2 h-4 w-4" />
            Columns
          </Button>
          <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Export Excel"}
          </Button>
          <Button onClick={openAddPledge}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pledge
          </Button>
        </div>

        <PledgeSummaryMetricCards
          metrics={summaryMetrics}
          variant="campaign"
          className="mb-6 shrink-0"
        />

        <Card
          id="collection-queue"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0 scroll-mt-6"
        >
          <CardContent className="min-h-0 flex-1 overflow-auto p-0">
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 z-20 bg-card [&_th]:bg-card">
                <TableRow className="hover:bg-transparent">
                  {visibleColumnSet.has("donor") ? (
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Donor Name"
                      active={Boolean(donorNameFilter.trim())}
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
                  ) : null}
                  {visibleColumnSet.has("email") ? <TableHead>Email</TableHead> : null}
                  {visibleColumnSet.has("phone") ? <TableHead>Phone</TableHead> : null}
                  {visibleColumnSet.has("pledged") ? <TableHead>Amount Pledged</TableHead> : null}
                  {visibleColumnSet.has("paid") ? <TableHead>Amount Paid</TableHead> : null}
                  {visibleColumnSet.has("balance") ? <TableHead>Balance</TableHead> : null}
                  {visibleColumnSet.has("status") ? (
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Status"
                      active={statusFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={statusFilter === "Partial" ? "Open" : statusFilter}
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
                            <SelectItem value="Fulfilled">Fulfilled</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  ) : null}
                  {lockedCampaignId || !visibleColumnSet.has("campaign") ? null : (
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
                  )}
                  {visibleColumnSet.has("emailReminder") ? (
                    <TableHead>Email reminder</TableHead>
                  ) : null}
                  {visibleColumnSet.has("callText") ? <TableHead>Call / text</TableHead> : null}
                  {visibleColumnSet.has("notes") ? <TableHead>Notes</TableHead> : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="text-center text-muted-foreground"
                    >
                      Loading pledges...
                    </TableCell>
                  </TableRow>
                ) : pledges.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="text-center text-muted-foreground"
                    >
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
                      {visibleColumnSet.has("donor") ? (
                      <TableCell>
                        <div>
                          <span className="font-medium text-primary">{pledge.donorName}</span>
                          <PledgeDonorSubline
                            contactType={pledge.contactType}
                            primaryContactName={pledge.primaryContactName}
                            memberGroups={pledge.memberGroups}
                          />
                        </div>
                      </TableCell>
                      ) : null}

                      {visibleColumnSet.has("email") ? (
                        <TableCell className="max-w-[220px] truncate text-sm" title={pledge.email || undefined}>
                          {pledge.email || "—"}
                        </TableCell>
                      ) : null}

                      {visibleColumnSet.has("phone") ? (
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatPhoneDisplayOrDash(pledge.phone)}
                        </TableCell>
                      ) : null}

                      {visibleColumnSet.has("pledged") ? (
                      <TableCell className="font-medium">
                        {formatCurrency(pledge.amount_pledged)}
                      </TableCell>
                      ) : null}

                      {visibleColumnSet.has("paid") ? (
                      <TableCell className="font-medium text-emerald-600">
                        {formatCurrency(pledge.amount_paid)}
                      </TableCell>
                      ) : null}

                      {visibleColumnSet.has("balance") ? (
                      <TableCell
                        className={
                          pledge.balance_remaining > 0
                            ? "font-medium text-amber-600"
                            : "text-muted-foreground"
                        }
                      >
                        {formatCurrency(pledge.balance_remaining)}
                      </TableCell>
                      ) : null}

                      {visibleColumnSet.has("status") ? (
                      <TableCell>{getStatusBadge(pledge.status)}</TableCell>
                      ) : null}

                      {lockedCampaignId || !visibleColumnSet.has("campaign") ? null : (
                        <TableCell>
                          <Badge variant="outline">{pledge.campaignName}</Badge>
                        </TableCell>
                      )}

                      {visibleColumnSet.has("emailReminder") ? (
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
                      ) : null}

                      {visibleColumnSet.has("callText") ? (
                      <TableCell className="text-sm text-muted-foreground">
                        {(() => {
                          const lines = callTextReminderLines(pledge, formatDisplayDate);
                          return (
                            <div className="flex flex-col items-start gap-1">
                              {lines.length === 0
                                ? null
                                : lines.map((line) => <div key={line}>{line}</div>)}
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto px-0"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOutreachPledge({
                                    id: pledge.id,
                                    donorName: pledge.donorName,
                                  });
                                }}
                              >
                                Log contact
                              </Button>
                            </div>
                          );
                        })()}
                      </TableCell>
                      ) : null}
                      {visibleColumnSet.has("notes") ? (
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {pledge.contactNotes ? (
                          <span className="line-clamp-2" title={pledge.contactNotes}>
                            {pledge.contactNotes}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {Math.ceil(totalPledges / DONATIONS_PAGE_SIZE) > 1 ? (
          <Pagination className="mt-4 shrink-0">
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

      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose columns</DialogTitle>
            <DialogDescription>
              Checked columns stay on the pledges table. Export Excel uses the same columns.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            {pledgeLedgerColumnOptions(includeCampaignColumn).map((column) => (
              <label key={column.id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={visibleColumnSet.has(column.id)}
                  disabled={column.locked}
                  onCheckedChange={(value) => {
                    const next = value
                      ? [...visibleColumns, column.id]
                      : visibleColumns.filter((id) => id !== column.id);
                    applyVisibleColumns(next);
                  }}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => applyVisibleColumns(defaultPledgeLedgerColumns(includeCampaignColumn))}
            >
              Reset
            </Button>
            <Button type="button" onClick={() => setColumnsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PledgeOutreachDialog
        open={outreachPledge != null}
        onOpenChange={(open) => {
          if (!open) setOutreachPledge(null);
        }}
        pledgeId={outreachPledge?.id ?? null}
        donorName={outreachPledge?.donorName || "this donor"}
        onUpdated={() => {
          void fetchPledges();
        }}
      />

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

    </>
  );
}

export default function PledgesPage() {
  return <PledgesLedger />;
}

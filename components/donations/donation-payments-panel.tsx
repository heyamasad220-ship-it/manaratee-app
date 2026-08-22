"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Download, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter";
import { DonationPaymentRowActions } from "@/components/donations/donation-payment-row-actions";
import { DonationOneTimeOverviewCards } from "@/components/donations/donation-one-time-overview-cards";
import { DonationGivingCharts } from "@/components/donations/donation-giving-charts";
import {
  fetchOpenPledgesForAllocationAction,
  fetchPaymentsExportAction,
  fetchPaymentsPageAction,
  getDonationGivingBreakdownAction,
  getDonationPaymentFilterOptionsAction,
  getDonationTransactionsSummaryAction,
  searchContactsForDonationPickerAction,
  type DonationGivingBreakdown,
  type DonationPaymentFilterOptions,
  type DonationTransactionsSummary,
  type PaymentStatusDisplayFilter,
  type PaymentTransactionTypeFilter,
  type PaymentsPageInput,
} from "@/lib/donations/donation-list-actions";
import {
  DONATION_RANGE_LABELS,
  DONATION_RANGE_PRESETS,
  donationRangeSearchParams,
  parseDonationRangeParam,
  resolveDonationRangeBounds,
  type DonationRangePreset,
} from "@/lib/donations/donation-date-range";
import { downloadPaymentsReportCsv } from "@/lib/donations/payment-report-csv";
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge";
import { ensureGroupMembershipForDonationAction } from "@/lib/contacts/group-giving-actions";
import { DonationGroupPicker } from "@/components/donations/donation-group-picker";
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields";
import { WishlistItemPicker } from "@/components/donations/wishlist-item-picker";
import {
  fetchPledgeAttribution,
  toPaymentAttributionColumns,
} from "@/lib/donations/payment-attribution";
import { canAllocatePayment } from "@/lib/donations/payment-net-amount";
import { mapPaymentToDonationHistoryRow } from "@/lib/donations/payment-admin-capabilities";
import { financialActivityStatusBadgeClass } from "@/lib/donations/donation-status";
import { getDonorProfilePath } from "@/lib/donations/donor-profile-path";
import { resolvePaymentDonorDisplayName } from "@/lib/donations/payment-donor-display";

type Payment = {
  id: string;
  amount: number | string | null;
  refunded_amount?: number | null;
  payment_date: string | null;
  source: string | null;
  source_type?: string | null;
  memo: string | null;
  pledge_id: string | null;
  recurring_donation_plan_id?: string | null;
  donor_id: string | null;
  contact_id: string | null;
  donor_type: string | null;
  status: string | null;
  sender_name: string | null;
  import_batch_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  donor_display_name?: string | null;
  donor_contact_id?: string | null;
  method_display?: string | null;
  status_display?: string | null;
  campaign_name?: string | null;
  fund_name?: string | null;
  campaign_group_name?: string | null;
  receipt_status?: string | null;
};

type ContactPickerOption = {
  contactId: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type PledgeOption = {
  id: string;
  donor_id: string | null;
  donor_name: string | null;
  campaign_name: string | null;
  amount_pledged: number | string | null;
  amount_paid: number | string | null;
  balance_remaining: number | string | null;
  calculated_status: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function paymentTypeLabel(payment: Payment) {
  if (payment.recurring_donation_plan_id) return "Recurring Donation";
  if (payment.pledge_id) return "Pledge Payment";
  return "One-Time Donation";
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPaymentDonorName(payment: Payment) {
  return (
    payment.donor_display_name ||
    resolvePaymentDonorDisplayName({
      senderName: payment.sender_name,
    })
  );
}

function getPaymentDonorProfilePath(payment: Payment) {
  if (!payment.donor_id) return null;
  return getDonorProfilePath(
    payment.donor_id,
    payment.donor_type,
    payment.donor_contact_id ?? payment.contact_id
  );
}

function canLinkPaymentToPledge(payment: Payment) {
  return canAllocatePayment({
    pledge_id: payment.pledge_id,
    status: payment.status,
    amount: Number(payment.amount || 0),
    refunded_amount: Number(payment.refunded_amount || 0),
  });
}

function toPaymentHistoryRow(payment: Payment) {
  return mapPaymentToDonationHistoryRow({
    id: payment.id,
    amount: Number(payment.amount || 0),
    refunded_amount: payment.refunded_amount,
    payment_date: payment.payment_date || "",
    source: payment.source,
    source_type: payment.source_type,
    status: payment.status,
    memo: payment.memo,
    import_batch_id: payment.import_batch_id,
    stripe_payment_intent_id: payment.stripe_payment_intent_id,
    stripe_charge_id: payment.stripe_charge_id,
    pledge_id: payment.pledge_id,
  });
}

export function DonationPaymentsPanel({
  embedded = false,
  readOnly = false,
  showCharts = false,
  defaultRange = "all",
  defaultStatusDisplay = "all",
}: {
  embedded?: boolean
  readOnly?: boolean
  showCharts?: boolean
  defaultRange?: DonationRangePreset
  defaultStatusDisplay?: PaymentStatusDisplayFilter | "all"
}) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [handledAddQuery, setHandledAddQuery] = useState(false);

  const range = parseDonationRangeParam(searchParams.get("range"), defaultRange);
  const { dateFrom, dateTo, label: rangeLabel } = resolveDonationRangeBounds(range);

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [page, setPage] = useState(1);
  const [donorNameFilter, setDonorNameFilter] = useState("");
  const [donorNameFilterInput, setDonorNameFilterInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatusDisplayFilter | "all">(
    defaultStatusDisplay
  );
  const [typeFilter, setTypeFilter] = useState<PaymentTransactionTypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [fundFilter, setFundFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [filterOptions, setFilterOptions] = useState<DonationPaymentFilterOptions>({
    sources: [],
    campaigns: [],
    funds: [],
    campaignGroups: [],
  });
  const [summary, setSummary] = useState<DonationTransactionsSummary | null>(null);
  const [breakdown, setBreakdown] = useState<DonationGivingBreakdown | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<ContactPickerOption[]>([]);
  const [pledges, setPledges] = useState<PledgeOption[]>([]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [donorOpen, setDonorOpen] = useState(false);
  const [donorSearch, setDonorSearch] = useState("");

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [source, setSource] = useState("cash");
  const [memo, setMemo] = useState("");
  const [attribution, setAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  );
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);
  const [selectedGroupContactId, setSelectedGroupContactId] = useState<string | null>(null);
  const [selectedGroupLabel, setSelectedGroupLabel] = useState("");

  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedPledgeId, setSelectedPledgeId] = useState("");
  const [allocating, setAllocating] = useState(false);

  const selectedContactName = useMemo(() => {
    if (!selectedContactId) return "No contact selected";

    const contact = contacts.find((item) => item.contactId === selectedContactId);

    return contact?.full_name || contact?.email || contact?.phone || "No contact selected";
  }, [selectedContactId, contacts]);

  const filteredContacts = contacts;

  const allocationPledges = selectedPayment?.donor_id
    ? pledges.filter((pledge) => pledge.donor_id === selectedPayment.donor_id)
    : pledges;

  const listFilters: PaymentsPageInput = useMemo(
    () => ({
      donorName: donorNameFilter || undefined,
      statusDisplay: statusFilter === "all" ? undefined : statusFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      transactionType: typeFilter === "all" ? undefined : typeFilter,
      source: sourceFilter === "all" ? undefined : sourceFilter,
      campaignId: campaignFilter === "all" ? undefined : campaignFilter,
      fundId: fundFilter === "all" ? undefined : fundFilter,
      campaignGroupId: groupFilter === "all" ? undefined : groupFilter,
    }),
    [
      donorNameFilter,
      statusFilter,
      dateFrom,
      dateTo,
      typeFilter,
      sourceFilter,
      campaignFilter,
      fundFilter,
      groupFilter,
    ]
  );

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

  async function loadPayments(nextPage = page) {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await fetchPaymentsPageAction({
        ...listFilters,
        page: nextPage,
        pageSize: DONATIONS_PAGE_SIZE,
      });

      if (!result.success) {
        setPayments([]);
        setTotalPayments(0);
        setLoadError(result.error || "Could not load payments.");
        return;
      }

      setPayments(result.payments as unknown as Payment[]);
      setTotalPayments(result.total);
      setPage(result.page);

      const effectiveOrgId = organizationId || (await getOrgIdForCurrentUser());
      if (effectiveOrgId && !organizationId) {
        setOrganizationId(effectiveOrgId);
      }

      if (effectiveOrgId) {
        const pledgeResult = await fetchOpenPledgesForAllocationAction();

        if (pledgeResult.success) {
          setPledges(pledgeResult.pledges as PledgeOption[]);
        }
      }
    } catch (error) {
      setPayments([]);
      setTotalPayments(0);
      setLoadError(error instanceof Error ? error.message : "Could not load payments.");
    } finally {
      setLoading(false);
    }
  }

  async function loadContactsForPicker(query: string) {
    const result = await searchContactsForDonationPickerAction(query, 50);
    if (result.success) {
      setContacts(result.contacts);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDonorNameFilter(donorNameFilterInput), 300);
    return () => clearTimeout(timer);
  }, [donorNameFilterInput]);

  useEffect(() => {
    setPage(1);
  }, [donorNameFilter, statusFilter, range, typeFilter, sourceFilter, campaignFilter, fundFilter, groupFilter]);

  useEffect(() => {
    void (async () => {
      const orgId = await getOrgIdForCurrentUser();
      if (orgId) {
        setOrganizationId(orgId);
        await loadContactsForPicker("");
      }
      const optionsResult = await getDonationPaymentFilterOptionsAction();
      if (optionsResult.success) {
        setFilterOptions(optionsResult.options);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action !== "add" || handledAddQuery) return;

    const contactId = searchParams.get("contactId");

    void (async () => {
      if (contactId) {
        const { data: contactRow } = await supabase
          .from("contacts")
          .select("id, full_name, email, phone")
          .eq("id", contactId)
          .maybeSingle();

        if (contactRow) {
          setContacts((current) => {
            if (current.some((item) => item.contactId === contactRow.id)) {
              return current;
            }
            return [
              {
                contactId: contactRow.id as string,
                full_name: (contactRow.full_name as string | null) ?? null,
                email: (contactRow.email as string | null) ?? null,
                phone: (contactRow.phone as string | null) ?? null,
              },
              ...current,
            ];
          });
          setSelectedContactId(contactRow.id as string);
          setDonorSearch(
            (contactRow.full_name as string | null) ||
              (contactRow.email as string | null) ||
              (contactRow.phone as string | null) ||
              ""
          );
        } else {
          setSelectedContactId(contactId);
        }
      }

      setPaymentDate(new Date().toISOString().slice(0, 10));
      setShowAddDialog(true);
      setHandledAddQuery(true);
      router.replace("/donations/payments/transactions", { scroll: false });
    })();
  }, [handledAddQuery, router, searchParams, supabase]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const result = await fetchPaymentsPageAction({
          ...listFilters,
          page,
          pageSize: DONATIONS_PAGE_SIZE,
        });

        if (cancelled) return;

        if (!result.success) {
          setPayments([]);
          setTotalPayments(0);
          setLoadError(result.error || "Could not load payments.");
          return;
        }

        setPayments(result.payments as unknown as Payment[]);
        setTotalPayments(result.total);
        setPage(result.page);

        setSummaryLoading(true);
        const [summaryResult, breakdownResult] = await Promise.all([
          getDonationTransactionsSummaryAction(listFilters),
          showCharts
            ? getDonationGivingBreakdownAction(listFilters)
            : Promise.resolve({ success: false as const, error: "" }),
        ]);
        if (cancelled) return;
        if (summaryResult.success) setSummary(summaryResult.summary);
        if (breakdownResult.success) setBreakdown(breakdownResult.breakdown);
        setSummaryLoading(false);

        const effectiveOrgId = organizationId || (await getOrgIdForCurrentUser());
        if (effectiveOrgId && !organizationId) {
          setOrganizationId(effectiveOrgId);
        }

        if (effectiveOrgId && !readOnly) {
          const pledgeResult = await fetchOpenPledgesForAllocationAction();
          if (cancelled) return;

          if (pledgeResult.success) {
            setPledges(pledgeResult.pledges as PledgeOption[]);
          }
        }
      } catch (error) {
        if (cancelled) return;
        setPayments([]);
        setTotalPayments(0);
        setLoadError(error instanceof Error ? error.message : "Could not load payments.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listFilters, page]);

  useEffect(() => {
    if (!showAddDialog) return;
    void loadContactsForPicker(donorSearch);
  }, [donorSearch, showAddDialog]);

  function handleRangeChange(next: DonationRangePreset) {
    const params = donationRangeSearchParams(searchParams, next, defaultRange);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  async function handleExport() {
    setExporting(true);
    const result = await fetchPaymentsExportAction(listFilters);
    setExporting(false);
    if (!result.success) {
      alert(result.error || "Could not export payments.");
      return;
    }
    if (result.payments.length === 0) {
      alert("No payments to export for the current filters.");
      return;
    }
    downloadPaymentsReportCsv(result.payments, new Date().toISOString(), rangeLabel);
  }

  function resetForm() {
    setSelectedContactId(null);
    setDonorOpen(false);
    setDonorSearch("");
    setAmount("");
    setPaymentDate("");
    setSource("cash");
    setMemo("");
    setAttribution(EMPTY_DONATION_ATTRIBUTION_VALUE);
    setWishlistItemId(null);
    setSelectedGroupContactId(null);
    setSelectedGroupLabel("");
  }

  async function handleAddPayment() {
    const orgId = organizationId || (await getOrgIdForCurrentUser());

    if (!orgId) {
      alert("No organization found for this admin user.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const selectedContact = selectedContactId
      ? contacts.find((contact) => contact.contactId === selectedContactId)
      : null;

    if (selectedGroupContactId && !selectedContactId) {
      alert("Select a contact when counting a gift toward a group.");
      return;
    }

    setSaving(true);

    if (selectedGroupContactId && selectedContactId) {
      const groupResult = await ensureGroupMembershipForDonationAction({
        memberContactId: selectedContactId,
        groupContactId: selectedGroupContactId,
      });

      if (!groupResult.success) {
        setSaving(false);
        alert(groupResult.error);
        return;
      }
    }

    let resolvedDonorId: string | null = null;

    if (selectedContactId) {
      resolvedDonorId = await ensureDonorExtensionForContact(orgId, selectedContactId);

      if (!resolvedDonorId) {
        setSaving(false);
        alert("Could not resolve a donor record for the selected contact.");
        return;
      }
    }

    const { error } = await supabase.from("payments").insert({
      organization_id: orgId,
      donor_id: resolvedDonorId,
      contact_id: selectedContactId,
      attributed_group_contact_id: selectedGroupContactId,
      pledge_id: null,
      sender_name: selectedContact?.full_name || selectedContact?.email || null,
      amount: Number(amount),
      payment_date: paymentDate ? `${paymentDate}T12:00:00` : new Date().toISOString(),
      source,
      source_type: "manual",
      memo: memo || null,
      status: resolvedDonorId ? "unallocated" : "pending_review",
      is_verified: false,
      ...toAttributionIds(attribution),
      wishlist_item_id: attribution.campaignId ? wishlistItemId : null,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    try {
      const { handleDonationAffiliationSync } = await import(
        "@/lib/contacts/contact-affiliation-sync"
      );
      await handleDonationAffiliationSync({
        donorId: resolvedDonorId,
        contactId: selectedContactId,
      });
    } catch (syncError) {
      console.warn("Donation affiliation sync failed:", syncError);
    }

    resetForm();
    setShowAddDialog(false);
    await loadPayments();
  }

  async function handleAllocatePayment() {
    if (!selectedPayment) {
      alert("No payment selected.");
      return;
    }

    if (!selectedPledgeId) {
      alert("Please select a pledge.");
      return;
    }

    const selectedPledge = pledges.find((pledge) => pledge.id === selectedPledgeId);

    if (!selectedPledge) {
      alert("Selected pledge not found.");
      return;
    }

    setAllocating(true);

    const pledgeAttribution = await fetchPledgeAttribution(supabase, selectedPledge.id);

    const { error } = await supabase
      .from("payments")
      .update({
        pledge_id: selectedPledge.id,
        donor_id: selectedPayment.donor_id || selectedPledge.donor_id || null,
        status: "allocated",
        reconciled_at: new Date().toISOString(),
        ...toPaymentAttributionColumns(pledgeAttribution),
      })
      .eq("id", selectedPayment.id);

    setAllocating(false);

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedPayment(null);
    setSelectedPledgeId("");
    setShowAllocateDialog(false);
    await loadPayments();
  }

  return (
    <>
      {!embedded ? <Header title="Payments" /> : null}

      <div className={embedded ? "space-y-6" : "p-6 space-y-6"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {readOnly ? "Gifts" : "Donation Transactions"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {readOnly
                ? "Read-only payment register for this report. Drill into a transaction for details."
                : "View and manage recorded fundraising payments for this organization."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(value) => handleRangeChange(value as DonationRangePreset)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DONATION_RANGE_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {DONATION_RANGE_LABELS[preset]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : "Export"}
            </Button>
            {readOnly ? null : (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Receive Payment
              </Button>
            )}
          </div>
        </div>

        <DonationOneTimeOverviewCards loading={summaryLoading} summary={summary} />

        {showCharts ? <DonationGivingCharts loading={summaryLoading} breakdown={breakdown} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {totalPayments > 0
              ? `${(page - 1) * DONATIONS_PAGE_SIZE + 1}–${Math.min(page * DONATIONS_PAGE_SIZE, totalPayments)} of ${totalPayments}`
              : "No payments"}
          </span>
        </div>

        {loadError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        <div className="rounded-lg border bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No payments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">
                      <TableColumnHeaderFilter
                        label="Donor"
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
                    </th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">
                      <TableColumnHeaderFilter
                        label="Type"
                        active={typeFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={typeFilter}
                            onValueChange={(value) => {
                              setTypeFilter(value as PaymentTransactionTypeFilter);
                              close();
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All types</SelectItem>
                              <SelectItem value="one_time">One-Time Donation</SelectItem>
                              <SelectItem value="pledge">Pledge Payment</SelectItem>
                              <SelectItem value="recurring">Recurring Donation</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </th>
                    <th className="text-left p-3">
                      <TableColumnHeaderFilter
                        label="Method"
                        active={sourceFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={sourceFilter}
                            onValueChange={(value) => {
                              setSourceFilter(value);
                              close();
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All methods</SelectItem>
                              {filterOptions.sources.map((source) => (
                                <SelectItem key={source.value} value={source.value}>
                                  {source.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </th>
                    <th className="text-left p-3">
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
                              <SelectValue placeholder="Select campaign" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All campaigns</SelectItem>
                              {filterOptions.campaigns.map((campaign) => (
                                <SelectItem key={campaign.id} value={campaign.id}>
                                  {campaign.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </th>
                    <th className="text-left p-3">
                      <TableColumnHeaderFilter
                        label="Fund"
                        active={fundFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={fundFilter}
                            onValueChange={(value) => {
                              setFundFilter(value);
                              close();
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select fund" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All funds</SelectItem>
                              {filterOptions.funds.map((fund) => (
                                <SelectItem key={fund.id} value={fund.id}>
                                  {fund.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </th>
                    <th className="text-left p-3">
                      <TableColumnHeaderFilter
                        label="Group"
                        active={groupFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={groupFilter}
                            onValueChange={(value) => {
                              setGroupFilter(value);
                              close();
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All groups</SelectItem>
                              {filterOptions.campaignGroups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </th>
                    <th className="text-left p-3">Receipt</th>
                    <th className="text-left p-3">
                      <TableColumnHeaderFilter
                        label="Status"
                        active={statusFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={statusFilter}
                            onValueChange={(value) => {
                              setStatusFilter(value as PaymentStatusDisplayFilter | "all");
                              close();
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="Succeeded">Succeeded</SelectItem>
                              <SelectItem value="Failed">Failed</SelectItem>
                              <SelectItem value="Refunded">Refunded</SelectItem>
                              <SelectItem value="Partially Refunded">Partially Refunded</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </th>
                    {readOnly ? null : <th className="text-right p-3">Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="p-3">{formatDate(payment.payment_date)}</td>

                      <td className="p-3">
                        {payment.donor_id ? (
                          <Link
                            href={getPaymentDonorProfilePath(payment) || "#"}
                            className="font-medium text-primary hover:underline"
                          >
                            {getPaymentDonorName(payment)}
                          </Link>
                        ) : (
                          getPaymentDonorName(payment)
                        )}
                      </td>

                      <td className="p-3 font-medium">
                        {formatCurrency(Number(payment.amount || 0))}
                      </td>

                      <td className="p-3 text-muted-foreground">{paymentTypeLabel(payment)}</td>

                      <td className="p-3 text-muted-foreground">
                        {payment.method_display || "—"}
                      </td>

                      <td className="p-3 text-muted-foreground">{payment.campaign_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{payment.fund_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{payment.campaign_group_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{payment.receipt_status || "—"}</td>

                      <td className="p-3">
                        {payment.status_display ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "whitespace-nowrap",
                              financialActivityStatusBadgeClass(payment.status_display)
                            )}
                          >
                            {payment.status_display}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>

                      {readOnly ? null : (
                      <td className="p-3 text-right">
                        <DonationPaymentRowActions
                          row={toPaymentHistoryRow(payment)}
                          onLinkToPledge={
                            canLinkPaymentToPledge(payment)
                              ? () => {
                                  setSelectedPayment(payment);
                                  setSelectedPledgeId("");
                                  setShowAllocateDialog(true);
                                }
                              : undefined
                          }
                          onUpdated={() => void loadPayments()}
                        />
                      </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {Math.ceil(totalPayments / DONATIONS_PAGE_SIZE) > 1 ? (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    setPage((current) => Math.max(1, current - 1))
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  {page} / {Math.ceil(totalPayments / DONATIONS_PAGE_SIZE)}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    setPage((current) =>
                      Math.min(Math.ceil(totalPayments / DONATIONS_PAGE_SIZE), current + 1)
                    )
                  }}
                  className={
                    page >= Math.ceil(totalPayments / DONATIONS_PAGE_SIZE)
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>
              Add a standalone donation payment for this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Contact</Label>

              <Popover open={donorOpen} onOpenChange={setDonorOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={donorOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedContactName}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search contact name, email, or phone..."
                      value={donorSearch}
                      onValueChange={setDonorSearch}
                    />

                    <CommandList>
                      <CommandEmpty>No contact found.</CommandEmpty>

                      <CommandGroup>
                        <CommandItem
                          value="No contact selected"
                          onSelect={() => {
                            setSelectedContactId(null);
                            setSelectedGroupContactId(null);
                            setSelectedGroupLabel("");
                            setDonorOpen(false);
                            setDonorSearch("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !selectedContactId ? "opacity-100" : "opacity-0"
                            )}
                          />
                          No contact selected
                        </CommandItem>

                        {filteredContacts.map((contact) => (
                          <CommandItem
                            key={contact.contactId}
                            value={contact.full_name || contact.email || contact.contactId}
                            onSelect={() => {
                              setSelectedContactId(contact.contactId);
                              setSelectedGroupContactId(null);
                              setSelectedGroupLabel("");
                              setDonorOpen(false);
                              setDonorSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedContactId === contact.contactId
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {contact.full_name || contact.email || contact.phone || "Unnamed contact"}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <DonationGroupPicker
              groupContactId={selectedGroupContactId}
              groupLabel={selectedGroupLabel}
              memberContactId={selectedContactId}
              onChange={(groupContactId, label) => {
                setSelectedGroupContactId(groupContactId);
                setSelectedGroupLabel(label);
              }}
              disabled={saving}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Method</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DonationAttributionFields
              organizationId={organizationId}
              value={attribution}
              onChange={(value) => {
                setAttribution(value);
                if (!value.campaignId) setWishlistItemId(null);
              }}
            />
            <WishlistItemPicker
              campaignId={attribution.campaignId || null}
              value={wishlistItemId}
              onChange={setWishlistItemId}
            />

            <div className="flex flex-col gap-2">
              <Label>Memo</Label>
              <Textarea
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="Optional note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowAddDialog(false);
              }}
            >
              Cancel
            </Button>

            <Button onClick={handleAddPayment} disabled={saving}>
              {saving ? "Saving..." : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAllocateDialog} onOpenChange={setShowAllocateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link to pledge</DialogTitle>
            <DialogDescription>
              Apply this payment toward an existing pledge.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="flex flex-col gap-4 py-4">
              <div className="rounded-md border p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Amount:</span>{" "}
                    <span className="font-medium">
                      {formatCurrency(Number(selectedPayment.amount || 0))}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Method:</span>{" "}
                    <span className="font-medium">
                      {selectedPayment.method_display || "—"}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Donor / Sender:</span>{" "}
                    {selectedPayment.donor_id ? (
                      <Link
                        href={getPaymentDonorProfilePath(selectedPayment) || "#"}
                        className="font-medium text-primary hover:underline"
                      >
                        {getPaymentDonorName(selectedPayment)}
                      </Link>
                    ) : (
                      <span className="font-medium">{getPaymentDonorName(selectedPayment)}</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-sm font-semibold text-foreground">Memo</p>
                  <p className="mt-1.5 break-all text-muted-foreground">
                    {selectedPayment.memo || "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Select Pledge</Label>

                <Select value={selectedPledgeId} onValueChange={setSelectedPledgeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a pledge" />
                  </SelectTrigger>

                  <SelectContent>
                    {allocationPledges.length === 0 ? (
                      <SelectItem value="no-pledges" disabled>
                        No matching pledges found
                      </SelectItem>
                    ) : (
                      allocationPledges.map((pledge) => (
                        <SelectItem key={pledge.id} value={pledge.id}>
                          {pledge.donor_name || "Unknown donor"} —{" "}
                          {pledge.campaign_name || "No Campaign"} — Balance:{" "}
                          {formatCurrency(Number(pledge.balance_remaining || 0))}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPayment(null);
                setSelectedPledgeId("");
                setShowAllocateDialog(false);
              }}
            >
              Cancel
            </Button>

            <Button onClick={handleAllocatePayment} disabled={allocating}>
              {allocating ? "Linking..." : "Link to pledge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

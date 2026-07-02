"use client";

import { PaymentHistory } from "@/components/donations/payment-history";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  ArrowUpDown,
  Heart,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge";
import { PledgeListRowActions } from "@/components/donations/pledge-list-row-actions";
import { PledgeDonorSubline } from "@/components/donations/pledge-donor-subline";
import { PledgeReminderActions } from "@/components/donations/pledge-reminder-actions";
import { ContactProfileDialog } from "@/components/contacts/contact-profile-dialog";
import {
  PledgeSummaryMetricCards,
  type PledgeSummaryMetrics,
} from "@/components/donations/pledge-summary-metric-cards";
import { formatPledgeReminderStatusLabel } from "@/lib/donations/pledge-reminder-types";
import {
  QuickAddContactDialog,
  type QuickAddContactResult,
} from "@/components/contacts/quick-add-contact-dialog";
import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields";
import { PledgeContactPicker } from "@/components/donations/pledge-contact-picker";
import { getPledgeForEditAction, updatePledgeAction } from "@/lib/donations/pledge-admin-actions";
import {
  fetchPledgeAttribution,
  toPaymentAttributionColumns,
} from "@/lib/donations/payment-attribution";
import {
  pledgeDisplayStatus,
  pledgeStatusToDb,
  type PledgeDisplayStatus,
} from "@/lib/donations/donation-status";
import {
  fetchPledgesPageAction,
  fetchPledgeSummaryMetricsAction,
  searchContactsForDonationPickerAction,
} from "@/lib/donations/donation-list-actions";
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination";
import {
  attachPledgeDonorContext,
  emptyPledgeDonorContext,
  type PledgeMemberGroup,
} from "@/lib/donations/pledge-donor-context";
import { DONATION_REPORTS_PLEDGES_PATH } from "@/lib/donations/donation-pledge-paths";
import type { ContactRecordType } from "@/lib/contacts/contact-constants";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Pledge {
  id: string;
  donorId: string | null;
  contactId: string | null;
  donorName: string;
  contactType: ContactRecordType | null;
  memberGroups: PledgeMemberGroup[];
  amount_pledged: number;
  amount_paid: number;
  balance_remaining: number;
  frequency: string;
  startDate: string;
  nextPayment: string | null;
  status: PledgeDisplayStatus;
  campaignName: string;
  campaignId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  notes?: string;
  lastReminderAt: string | null;
  lastReminderStatus: string | null;
  lastContactedAt: string | null;
}

interface ContactPickerOption {
  contactId: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

type CampaignOption = {
  id: string;
  name: string;
};

type PaymentHistoryItem = {
  id: string;
  amount: number | string;
  payment_date: string | null;
  source: string | null;
  memo: string | null;
};

function formatPlainDate(date?: string | null) {
  if (!date) return "N/A";
  return date.slice(0, 10);
}

function normalizeDateInput(date?: string | null) {
  if (!date) return null;
  return date.slice(0, 10);
}

function getTodayPlainDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
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
    nextPayment: null,
    status: pledgeDisplayStatus(row.calculated_status, amountPledged, amountPaid),
    campaignName: row.campaign_name || "Unassigned",
    campaignId: row.campaign_id || null,
    categoryId: null,
    subcategoryId: null,
    notes: row.notes || undefined,
    lastReminderAt: null,
    lastReminderStatus: null,
    lastContactedAt: null,
  };
}

function pledgeFromEditResult(
  result: Extract<Awaited<ReturnType<typeof getPledgeForEditAction>>, { success: true }>
): Pledge {
  const pledge = result.pledge;

  return {
    id: pledge.id,
    donorId: pledge.donorId,
    contactId: pledge.contactId,
    donorName: pledge.donorName,
    ...emptyPledgeDonorContext(),
    amount_pledged: pledge.amountPledged,
    amount_paid: pledge.amountPaid,
    balance_remaining: pledge.balanceRemaining,
    frequency: pledge.frequency,
    startDate: pledge.pledgeDate,
    nextPayment: null,
    status: pledge.status,
    campaignName: "",
    campaignId: pledge.campaignId || null,
    categoryId: pledge.categoryId || null,
    subcategoryId: pledge.subcategoryId || null,
    notes: pledge.notes || undefined,
    lastReminderAt: null,
    lastReminderStatus: null,
    lastContactedAt: null,
  };
}

export default function PledgesPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showDonorList, setShowDonorList] = useState(false);
  const [showQuickAddContact, setShowQuickAddContact] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [minAmountFilter, setMinAmountFilter] = useState("");
  const [debouncedMinAmount, setDebouncedMinAmount] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPledges, setTotalPledges] = useState(0);
  const [summaryMetrics, setSummaryMetrics] = useState<PledgeSummaryMetrics>({
    totalPledged: 0,
    totalCollected: 0,
    outstandingBalance: 0,
    activePledgeCount: 0,
    pledgeCount: 0,
  });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);

  const [selectedPledge, setSelectedPledge] = useState<Pledge | null>(null);
  const [paymentPledge, setPaymentPledge] = useState<Pledge | null>(null);

  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);

  const [pledgePayments, setPledgePayments] = useState<PaymentHistoryItem[]>([]);
  const [loadingPledgePayments, setLoadingPledgePayments] = useState(false);
  const [pledgePaymentsError, setPledgePaymentsError] = useState<string | null>(null);

  const [contactOptions, setContactOptions] = useState<ContactPickerOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");

  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);

  const [addAttribution, setAddAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  );
  const [amount, setAmount] = useState("");
  const [pledgeDate, setPledgeDate] = useState("");
  const [frequency, setFrequency] = useState("One-Time");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editAmount, setEditAmount] = useState("");
  const [editAttribution, setEditAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  );
  const [editPledgeDate, setEditPledgeDate] = useState("");
  const [editFrequency, setEditFrequency] = useState("One-Time");
  const [editStatus, setEditStatus] = useState<PledgeDisplayStatus>("Open");
  const [editContactId, setEditContactId] = useState("");
  const [editContactLabel, setEditContactLabel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentSource, setPaymentSource] = useState("cash");
  const [paymentMemo, setPaymentMemo] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [donorSearch, setDonorSearch] = useState("");
  const [contactProfileId, setContactProfileId] = useState<string | null>(null);
  const [showContactProfile, setShowContactProfile] = useState(false);
  const [handledPledgeQuery, setHandledPledgeQuery] = useState<string | null>(null);
  const [handledAddQuery, setHandledAddQuery] = useState(false);

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

  async function searchContactsForPicker(searchValue: string) {
    const result = await searchContactsForDonationPickerAction(searchValue, 50);

    if (!result.success) {
      console.error("Error searching contacts:", result.error);
      setContactOptions([]);
      return;
    }

    setContactOptions(result.contacts);
  }

  async function handleDeletePledge(pledgeId: string) {
    if (!confirm("Delete this pledge? Related payments will stay in Payments but will be unallocated from this pledge.")) return;

    const orgId = organizationId || (await getOrgIdForCurrentUser());

    if (!orgId) {
      alert("No organization found.");
      return;
    }

    const { error: unlinkPaymentsError } = await supabase
      .from("payments")
      .update({ pledge_id: null })
      .eq("pledge_id", pledgeId)
      .eq("organization_id", orgId);

    if (unlinkPaymentsError) {
      alert(unlinkPaymentsError.message);
      return;
    }

    const { error: pledgeError } = await supabase
      .from("pledges")
      .delete()
      .eq("id", pledgeId)
      .eq("organization_id", orgId);

    if (pledgeError) {
      alert(pledgeError.message);
      return;
    }

    setSelectedPledge(null);
    setPaymentPledge(null);
    setPledgePayments([]);

    await fetchPledges();
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
      setContactOptions([]);
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
        search: debouncedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusMap[statusFilter],
        campaignId: campaignFilter === "all" ? undefined : campaignFilter,
        minAmountPledged: debouncedMinAmount,
      });

    const metricsResult = await fetchPledgeSummaryMetricsAction({
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusMap[statusFilter],
      campaignId: campaignFilter === "all" ? undefined : campaignFilter,
      minAmountPledged: debouncedMinAmount,
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

    setPledges(await attachPledgeDonorContext(supabase, orgId, await attachReminderSummaries(supabase, orgId, mapped)));
    setLoading(false);
  };

  const loadPledgePayments = async (pledgeId: string, orgId: string) => {
    setLoadingPledgePayments(true);
    setPledgePaymentsError(null);

    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, payment_date, source, memo")
      .eq("organization_id", orgId)
      .eq("pledge_id", pledgeId)
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("Error loading pledge payments:", error);
      setPledgePayments([]);
      setPledgePaymentsError("Could not load payment history");
      setLoadingPledgePayments(false);
      return;
    }

    const mappedPayments: PaymentHistoryItem[] = (data || []).map((payment: any) => ({
      id: payment.id,
      amount: payment.amount,
      payment_date: normalizeDateInput(payment.payment_date),
      source: payment.source,
      memo: payment.memo,
    }));

    setPledgePayments(mappedPayments);
    setLoadingPledgePayments(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const trimmed = minAmountFilter.trim();
    const parsed = trimmed ? Number(trimmed.replace(/,/g, "")) : NaN;
    const timer = setTimeout(() => {
      setDebouncedMinAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [minAmountFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, campaignFilter, debouncedMinAmount]);

  useEffect(() => {
    fetchPledges(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, campaignFilter, debouncedMinAmount, page]);

  useEffect(() => {
    if (window.location.hash === "#collection-queue") {
      document.getElementById("collection-queue")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading]);

  useEffect(() => {
    if (!selectedPledge || !organizationId) {
      setPledgePayments([]);
      setPledgePaymentsError(null);
      return;
    }

    loadPledgePayments(selectedPledge.id, organizationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPledge, organizationId]);

  useEffect(() => {
    if (!showAddDialog) return;
    void searchContactsForPicker(donorSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donorSearch, showAddDialog]);

  useEffect(() => {
    const campaignId = searchParams.get("campaignId");
    const action = searchParams.get("action");
    if (!campaignId || action === "add") return;

    setCampaignFilter(campaignId);
  }, [searchParams]);

  useEffect(() => {
    const pledgeId = searchParams.get("pledgeId");
    if (pledgeId) return;

    const action = searchParams.get("action");
    if (action !== "add" || handledAddQuery) return;

    const campaignId = searchParams.get("campaignId");
    if (campaignId) {
      setCampaignFilter(campaignId);
      setAddAttribution((current) => ({
        ...current,
        campaignId,
      }));
    }

    setPledgeDate(getTodayPlainDate());
    setShowAddDialog(true);
    setHandledAddQuery(true);
    router.replace(DONATION_REPORTS_PLEDGES_PATH, { scroll: false });
  }, [searchParams, handledAddQuery, router]);

  useEffect(() => {
    const pledgeId = searchParams.get("pledgeId");
    if (!pledgeId) return;

    const action = searchParams.get("action") || "view";
    const queryKey = `${pledgeId}:${action}`;
    if (handledPledgeQuery === queryKey) return;

    let cancelled = false;

    void (async () => {
      const result = await getPledgeForEditAction(pledgeId);
      if (cancelled) return;

      if (!result.success) {
        alert(result.error);
        router.replace(DONATION_REPORTS_PLEDGES_PATH, { scroll: false });
        return;
      }

      setOrganizationId(result.organizationId);
      const [pledge] = await attachPledgeDonorContext(supabase, result.organizationId, [
        pledgeFromEditResult(result),
      ]);

      if (action === "edit") {
        setEditingPledge(pledge);
        setEditAmount(String(pledge.amount_pledged || ""));
        setEditAttribution({
          campaignId: pledge.campaignId || "",
          categoryId: pledge.categoryId || "",
          subcategoryId: pledge.subcategoryId || "",
        });
        setEditPledgeDate(pledge.startDate || "");
        setEditFrequency(pledge.frequency || "One-Time");
        setEditStatus(pledge.status || "Open");
        setEditContactId(pledge.contactId || "");
        setEditContactLabel(pledge.donorName || "");
      } else if (action === "pay") {
        setPaymentPledge(pledge);
        setPaymentAmount("");
        setPaymentDate("");
        setPaymentSource("cash");
        setPaymentMemo("");
        setShowPaymentDialog(true);
      } else {
        setSelectedPledge(pledge);
      }

      setHandledPledgeQuery(queryKey);
      router.replace(DONATION_REPORTS_PLEDGES_PATH, { scroll: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, handledPledgeQuery, router]);

  const resetAddPledgeForm = () => {
    setSelectedContactId("");
    setAddAttribution(EMPTY_DONATION_ATTRIBUTION_VALUE);
    setAmount("");
    setPledgeDate("");
    setFrequency("One-Time");
    setNotes("");
    setDonorSearch("");
    setShowDonorList(false);
    setShowQuickAddContact(false);
  };

  const handleQuickAddContactCreated = (contact: QuickAddContactResult) => {
    setContactOptions([
      {
        contactId: contact.contactId,
        full_name: contact.full_name,
        email: contact.email,
        phone: contact.phone,
      },
    ]);
    setSelectedContactId(contact.contactId);
    setDonorSearch(contact.full_name || contact.email || contact.phone || "");
    setShowDonorList(false);
  };

  const resetPaymentForm = () => {
    setPaymentAmount("");
    setPaymentDate("");
    setPaymentSource("cash");
    setPaymentMemo("");
  };

  const openEditPledge = (pledge: Pledge) => {
    setEditingPledge(pledge);
    setEditAmount(String(pledge.amount_pledged || ""));
    setEditAttribution({
      campaignId: pledge.campaignId || "",
      categoryId: pledge.categoryId || "",
      subcategoryId: pledge.subcategoryId || "",
    });
    setEditPledgeDate(pledge.startDate || "");
    setEditFrequency(pledge.frequency || "One-Time");
    setEditStatus(pledge.status || "Open");
    setEditContactId(pledge.contactId || "");
    setEditContactLabel(pledge.donorName || "");
  };

  const handleAddPledge = async () => {
    const orgId = organizationId || (await getOrgIdForCurrentUser());

    if (!orgId) {
      alert("No organization found for this admin user.");
      return;
    }

    if (!selectedContactId) {
      alert("Please select a contact.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setSaving(true);

    const donorId = await ensureDonorExtensionForContact(orgId, selectedContactId);

    if (!donorId) {
      setSaving(false);
      alert("Could not resolve a donor record for the selected contact.");
      return;
    }

    const { error } = await supabase.from("pledges").insert({
      organization_id: orgId,
      donor_id: donorId,
      ...toAttributionIds(addAttribution),
      amount_pledged: Number(amount),
      pledge_date: normalizeDateInput(pledgeDate) || getTodayPlainDate(),
      pledge_type: frequency.toLowerCase().replace("-", "_"),
      frequency: frequency.toLowerCase().replace("-", "_"),
      status: "open",
      notes: notes || null,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    resetAddPledgeForm();
    setShowAddDialog(false);
    await fetchPledges();
  };

  const refreshSelectedPledge = async (pledgeId: string, orgId: string) => {
    const { data, error } = await supabase
      .from("pledge_status_view")
      .select(
        "id, organization_id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, frequency, pledge_date, notes"
      )
      .eq("organization_id", orgId)
      .eq("id", pledgeId)
      .single();

    if (error || !data) return;

    const updatedPledge = pledgeFromRow(data);

    const [enrichedPledge] = await attachPledgeDonorContext(supabase, orgId, [updatedPledge]);

    setSelectedPledge(enrichedPledge);
    setPaymentPledge(enrichedPledge);
  };

  const handleUpdatePledge = async () => {
    if (!editingPledge) return;

    if (!editAmount || Number(editAmount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (!editContactId) {
      alert("Please select a contact for this pledge.");
      return;
    }

    setSavingEdit(true);

    const result = await updatePledgeAction({
      pledgeId: editingPledge.id,
      amountPledged: Number(editAmount),
      pledgeDate: editPledgeDate,
      frequency: editFrequency,
      status: editStatus,
      campaignId: editAttribution.campaignId || null,
      categoryId: editAttribution.categoryId || null,
      subcategoryId: editAttribution.subcategoryId || null,
      contactId: editContactId,
    });

    setSavingEdit(false);

    if (!result.success) {
      alert(result.error);
      return;
    }

    setEditingPledge(null);
    await fetchPledges();

    const orgId = organizationId || (await getOrgIdForCurrentUser());
    if (orgId && selectedPledge?.id === editingPledge.id) {
      await refreshSelectedPledge(editingPledge.id, orgId);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentPledge) return;

    const orgId = organizationId || (await getOrgIdForCurrentUser());

    if (!orgId) {
      alert("No organization found for this admin user.");
      return;
    }

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    setSavingPayment(true);

    let contactId = paymentPledge.contactId;

    if (!contactId && paymentPledge.donorId) {
      const { data: donorRow } = await supabase
        .from("donors")
        .select("contact_id")
        .eq("id", paymentPledge.donorId)
        .maybeSingle();

      contactId = (donorRow?.contact_id as string | null) ?? null;
    }

    const paymentDateValue = normalizeDateInput(paymentDate) || getTodayPlainDate();
    const pledgeAttribution = await fetchPledgeAttribution(supabase, paymentPledge.id);

    const { error: paymentError } = await supabase.from("payments").insert({
      organization_id: orgId,
      donor_id: paymentPledge.donorId,
      contact_id: contactId,
      pledge_id: paymentPledge.id,
      sender_name: paymentPledge.donorName,
      amount: Number(paymentAmount),
      payment_date: `${paymentDateValue}T12:00:00`,
      source: paymentSource,
      source_type: "manual",
      memo: paymentMemo || null,
      status: "allocated",
      is_verified: false,
      ...toPaymentAttributionColumns(pledgeAttribution),
    });

    if (paymentError) {
      setSavingPayment(false);
      alert(paymentError.message);
      return;
    }

    if (contactId || paymentPledge.donorId) {
      try {
        const { handleDonationAffiliationSync } = await import(
          "@/lib/contacts/contact-affiliation-sync"
        );
        await handleDonationAffiliationSync({
          organizationId: orgId,
          donorId: paymentPledge.donorId,
          contactId,
        });
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : String(syncError);
        console.error(`[staff-pledges] affiliation sync failed (pledge payment): ${message}`);
      }
    }

    setSavingPayment(false);

    resetPaymentForm();
    setShowPaymentDialog(false);

    await fetchPledges();
    await loadPledgePayments(paymentPledge.id, orgId);
    await refreshSelectedPledge(paymentPledge.id, orgId);
  };

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

  const filteredContactOptions = contactOptions;

  return (
    <>
      <div className="p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search pledges..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Campaign" />
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Fulfilled">Fulfilled</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Min amount ($)"
              value={minAmountFilter}
              onChange={(event) => setMinAmountFilter(event.target.value)}
              className="w-[150px]"
            />
          </div>

          <Button onClick={() => setShowAddDialog(true)}>
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
                    <Button variant="ghost" className="h-auto p-0 font-medium hover:bg-transparent">
                      Donor
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Amount Pledged</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Last Reminder</TableHead>
                  <TableHead>Last Contacted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Loading pledges...
                    </TableCell>
                  </TableRow>
                ) : pledges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No pledges found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pledges.map((pledge) => (
                    <TableRow
                      key={pledge.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedPledge(pledge)}
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

                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <PledgeListRowActions
                            pledgeId={pledge.id}
                            donorName={pledge.donorName}
                            balanceRemaining={pledge.balance_remaining}
                            onViewDetails={() => setSelectedPledge(pledge)}
                            onRecordPayment={() => {
                              setPaymentPledge(pledge);
                              setShowPaymentDialog(true);
                            }}
                            onEditPledge={() => openEditPledge(pledge)}
                            onDeletePledge={() => void handleDeletePledge(pledge.id)}
                            onReminderUpdated={() => void fetchPledges()}
                          />
                        </div>
                      </TableCell>
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Pledge</DialogTitle>
            <DialogDescription>Create a new donation pledge commitment.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact">Contact</Label>
              <Input
                id="contact"
                placeholder="Search contact by name, email, or phone..."
                value={donorSearch}
                onFocus={() => setShowDonorList(true)}
                onChange={(event) => {
                  const value = event.target.value;

                  setDonorSearch(value);
                  setShowDonorList(true);
                }}
              />

              {selectedContactId && (
                <div className="text-sm text-muted-foreground">
                  Selected:{" "}
                  <span className="font-medium">
                    {contactOptions.find((contact) => contact.contactId === selectedContactId)
                      ?.full_name ||
                      contactOptions.find((contact) => contact.contactId === selectedContactId)
                        ?.email}
                  </span>
                </div>
              )}

              {showDonorList && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {filteredContactOptions.length === 0 ? (
                    <div className="space-y-2 px-3 py-3 text-sm text-muted-foreground">
                      <p>No contacts found.</p>
                      {donorSearch.trim() ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setShowQuickAddContact(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add contact
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    filteredContactOptions.map((contact) => (
                      <button
                        key={contact.contactId}
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                          selectedContactId === contact.contactId ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => {
                          setSelectedContactId(contact.contactId);
                          setDonorSearch(contact.full_name || contact.email || "");
                          setShowDonorList(false);
                        }}
                      >
                        {contact.full_name || contact.email || contact.phone || "Unnamed contact"}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="total-amount">Total Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="total-amount"
                  type="number"
                  placeholder="0.00"
                  className="pl-7"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>

            <DonationAttributionFields
              organizationId={organizationId}
              value={addAttribution}
              onChange={setAddAttribution}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pledge-date">Pledge Date</Label>
                <Input
                  id="pledge-date"
                  type="date"
                  value={pledgeDate}
                  onChange={(event) => setPledgeDate(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="pledge-type">Pledge Type</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="pledge-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="One-Time">One-Time</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes..."
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddPledgeForm();
                setShowAddDialog(false);
              }}
            >
              Cancel
            </Button>

            <Button onClick={handleAddPledge} disabled={saving}>
              {saving ? "Saving..." : "Add Pledge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddContactDialog
        open={showQuickAddContact}
        onOpenChange={setShowQuickAddContact}
        searchHint={donorSearch}
        onCreated={handleQuickAddContactCreated}
      />

      <Dialog open={!!editingPledge} onOpenChange={(open) => !open && setEditingPledge(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Pledge</DialogTitle>
            <DialogDescription>
              Update pledge details. Change the assigned contact to move this pledge to a person,
              organization, or group.
            </DialogDescription>
          </DialogHeader>

          {editingPledge && (
            <div className="flex flex-col gap-4 py-4">
              <PledgeContactPicker
                organizationId={organizationId}
                contactId={editContactId}
                contactLabel={editContactLabel}
                onChange={(contactId, label) => {
                  setEditContactId(contactId);
                  setEditContactLabel(label);
                }}
                disabled={savingEdit}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-total-amount">Total Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="edit-total-amount"
                      type="number"
                      className="pl-7"
                      value={editAmount}
                      onChange={(event) => setEditAmount(event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <DonationAttributionFields
                    organizationId={organizationId}
                    value={editAttribution}
                    onChange={setEditAttribution}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-pledge-date">Pledge Date</Label>
                  <Input
                    id="edit-pledge-date"
                    type="date"
                    value={editPledgeDate}
                    onChange={(event) => setEditPledgeDate(event.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-pledge-type">Pledge Type</Label>
                  <Select value={editFrequency} onValueChange={setEditFrequency}>
                    <SelectTrigger id="edit-pledge-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="One-Time">One-Time</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editStatus} onValueChange={(value) => setEditStatus(value as PledgeDisplayStatus)}>
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Fulfilled">Fulfilled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPledge(null)}>
              Cancel
            </Button>

            <Button onClick={handleUpdatePledge} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Add a payment for this pledge</DialogDescription>
          </DialogHeader>

          {paymentPledge && (
            <div className="flex flex-col gap-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground">Donor</p>
                <p className="font-medium">{paymentPledge.donorName}</p>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
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

              <div className="flex flex-col gap-2">
                <Label>Method</Label>
                <Select value={paymentSource} onValueChange={setPaymentSource}>
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
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Memo</Label>
                <Textarea
                  value={paymentMemo}
                  onChange={(event) => setPaymentMemo(event.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentDialog(false);
                setPaymentPledge(null);
                resetPaymentForm();
              }}
            >
              Cancel
            </Button>

            <Button onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment ? "Saving..." : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPledge} onOpenChange={(open) => !open && setSelectedPledge(null)}>
        <DialogContent className="flex w-[min(96vw,56rem)] max-w-4xl flex-col gap-0 overflow-visible sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Pledge Details</DialogTitle>
            <DialogDescription>View and manage pledge information</DialogDescription>
          </DialogHeader>

          {selectedPledge && (
            <div className="flex flex-col gap-6 py-4">
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(selectedPledge.status)}
                <Badge variant="outline">{selectedPledge.campaignName}</Badge>
                <Badge variant="secondary">{selectedPledge.frequency}</Badge>
              </div>

              <DonationMetricCardGrid colorful columns={3} className="grid-cols-1 sm:grid-cols-3">
                <DonationMetricCard
                  title="Amount Pledged"
                  value={formatCurrency(selectedPledge.amount_pledged)}
                  icon={Heart}
                  accent="blue"
                />
                <DonationMetricCard
                  title="Amount Paid"
                  value={formatCurrency(selectedPledge.amount_paid)}
                  icon={DollarSign}
                  accent="emerald"
                />
                <DonationMetricCard
                  title="Balance"
                  value={formatCurrency(selectedPledge.balance_remaining)}
                  icon={AlertCircle}
                  accent="amber"
                />
              </DonationMetricCardGrid>

              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">
                    {selectedPledge.amount_pledged > 0
                      ? Math.round((selectedPledge.amount_paid / selectedPledge.amount_pledged) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    selectedPledge.amount_pledged > 0
                      ? (selectedPledge.amount_paid / selectedPledge.amount_pledged) * 100
                      : 0
                  }
                  className="h-3"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Donor</span>
                  <button
                    type="button"
                    className="w-fit font-medium text-primary hover:underline"
                    onClick={() => void openContactProfile(selectedPledge)}
                  >
                    {selectedPledge.donorName}
                  </button>
                  <PledgeDonorSubline
                    contactType={selectedPledge.contactType}
                    primaryContactName={selectedPledge.primaryContactName}
                    memberGroups={selectedPledge.memberGroups}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Next Payment</span>
                  <span className="font-medium">
                    {formatPlainDate(selectedPledge.nextPayment)}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Start Date</span>
                  <span className="font-medium">
                    {formatPlainDate(selectedPledge.startDate)}
                  </span>
                </div>
              </div>

              {selectedPledge.notes && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedPledge.notes}</p>
                </div>
              )}

              {selectedPledge.balance_remaining > 0.009 && (
                <div className="rounded-lg border p-4">
                  <p className="mb-3 text-sm font-medium">Pledge Collection</p>
                  <PledgeReminderActions
                    pledgeId={selectedPledge.id}
                    donorName={selectedPledge.donorName}
                    onUpdated={() => {
                      if (organizationId) refreshSelectedPledge(selectedPledge.id, organizationId);
                    }}
                  />
                </div>
              )}

              <div className="space-y-3">
                {loadingPledgePayments ? (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    Loading payment history...
                  </div>
                ) : pledgePaymentsError ? (
                  <div className="rounded-md border p-4 text-sm text-red-600">
                    {pledgePaymentsError}
                  </div>
                ) : (
                  <PaymentHistory payments={pledgePayments} />
                )}
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4 flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedPledge) return;
                void openContactProfile(selectedPledge);
              }}
            >
              View Contact
            </Button>

  <Button
    variant="outline"
    onClick={() => {
      if (!selectedPledge) return;
      openEditPledge(selectedPledge);
    }}
  >
    Edit Pledge
  </Button>

  <Button
    onClick={() => {
      if (!selectedPledge) return;
      setPaymentPledge(selectedPledge);
      setShowPaymentDialog(true);
    }}
  >
    Record Payment
  </Button>
</DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactProfileDialog
        contactId={contactProfileId}
        open={showContactProfile}
        onOpenChange={setShowContactProfile}
        onContactUpdated={() => void fetchPledges()}
      />
    </>
  );
}

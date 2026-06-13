"use client";

import { PaymentHistory } from "@/components/donations/payment-history";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import Link from "next/link";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  MoreHorizontal,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge";
import { PledgeReminderActions } from "@/components/donations/pledge-reminder-actions";
import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields";
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
} from "@/lib/donations/donation-list-actions";
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination";
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
  donorType: string;
  amount_pledged: number;
  amount_paid: number;
  balance_remaining: number;
  frequency: string;
  startDate: string;
  nextPayment: string | null;
  status: PledgeDisplayStatus;
  fundName: string;
  campaignId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  notes?: string;
}

interface DonorOption {
  id: string;
  contact_id: string;
  full_name: string | null;
  email: string | null;
}

type FundOption = {
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

function pledgeFromRow(row: any): Pledge {
  const amountPledged = Number(row.amount_pledged || 0);
  const amountPaid = Number(row.amount_paid || 0);

  return {
    id: row.id,
    donorId: row.donor_id || null,
    contactId: row.contact_id || null,
    donorName: row.donor_name || "Unknown donor",
    donorType: "Donor",
    amount_pledged: amountPledged,
    amount_paid: amountPaid,
    balance_remaining: Number(row.balance_remaining ?? Math.max(amountPledged - amountPaid, 0)),
    frequency: row.frequency || "One-Time",
    startDate: normalizeDateInput(row.pledge_date) || "",
    nextPayment: null,
    status: pledgeDisplayStatus(row.calculated_status, amountPledged, amountPaid),
    fundName: row.campaign_name || "General Fund",
    campaignId: row.campaign_id || null,
    categoryId: null,
    subcategoryId: null,
    notes: row.notes || undefined,
  };
}

export default function PledgesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [showDonorList, setShowDonorList] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPledges, setTotalPledges] = useState(0);
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalPledged: 0,
    totalCollected: 0,
    outstandingBalance: 0,
    activePledgeCount: 0,
  });
  const [fundFilter, setFundFilter] = useState<string>("all");

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

  const [donorOptions, setDonorOptions] = useState<DonorOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");

  const [fundOptions, setFundOptions] = useState<FundOption[]>([]);

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
  const [savingEdit, setSavingEdit] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentSource, setPaymentSource] = useState("cash");
  const [paymentMemo, setPaymentMemo] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [donorSearch, setDonorSearch] = useState("");

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

  async function searchDonors(searchValue: string, orgIdOverride?: string) {
    const orgId = orgIdOverride || organizationId;

    if (!orgId) return;

    let query = supabase
      .from("donors")
      .select("id, contact_id, full_name, email")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true })
      .limit(50);

    if (searchValue.trim().length >= 1) {
      const cleanSearch = searchValue.trim().replaceAll(",", "").replaceAll("%", "");
      query = query.or(`full_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error searching donors:", JSON.stringify(error, null, 2));
      setDonorOptions([]);
      return;
    }

    setDonorOptions((data || []) as DonorOption[]);
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
  async function loadFundOptions(orgId: string, currentPledges: Pledge[] = []) {
    const optionsFromPledges = currentPledges
      .map((pledge) => pledge.fundName)
      .filter(Boolean)
      .map((name) => ({ id: name, name }));

    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (error) {
      console.warn("Could not load campaigns table. Using funds already found on pledges.", error);
      setFundOptions(dedupeFundOptions(optionsFromPledges));
      return;
    }

    const campaignOptions = (data || [])
      .filter((campaign: any) => campaign.name)
      .map((campaign: any) => ({
        id: String(campaign.id),
        name: String(campaign.name),
      }));

    setFundOptions(dedupeFundOptions([...campaignOptions, ...optionsFromPledges]));
  }

  function dedupeFundOptions(options: FundOption[]) {
    const seen = new Set<string>();

    return options.filter((option) => {
      const key = option.name.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }

  const fetchPledges = async (nextPage = page) => {
    setLoading(true);

    const orgId = await getOrgIdForCurrentUser();

    if (!orgId) {
      setOrganizationId(null);
      setPledges([]);
      setDonorOptions([]);
      setFundOptions([]);
      setLoading(false);
      return;
    }

    setOrganizationId(orgId);

    await searchDonors("", orgId);

    const statusMap: Record<string, string> = {
      Open: "open",
      Partial: "partial",
      Fulfilled: "fulfilled",
    };

    const [pageResult, metricsResult] = await Promise.all([
      fetchPledgesPageAction({
        page: nextPage,
        pageSize: DONATIONS_PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusMap[statusFilter],
      }),
      fetchPledgeSummaryMetricsAction(),
    ]);

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

    setPledges(mapped);
    await loadFundOptions(orgId, mapped);
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
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchPledges(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    if (!selectedPledge || !organizationId) {
      setPledgePayments([]);
      setPledgePaymentsError(null);
      return;
    }

    loadPledgePayments(selectedPledge.id, organizationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPledge, organizationId]);

  const resetAddPledgeForm = () => {
    setSelectedContactId("");
    setAddAttribution(EMPTY_DONATION_ATTRIBUTION_VALUE);
    setAmount("");
    setPledgeDate("");
    setFrequency("One-Time");
    setNotes("");
    setDonorSearch("");
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
  };

  const handleAddPledge = async () => {
    const orgId = organizationId || (await getOrgIdForCurrentUser());

    if (!orgId) {
      alert("No organization found for this admin user.");
      return;
    }

    if (!selectedContactId) {
      alert("Please select a donor.");
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

    setSelectedPledge(updatedPledge);
    setPaymentPledge(updatedPledge);
  };

  const handleUpdatePledge = async () => {
    if (!editingPledge) return;

    const orgId = organizationId || (await getOrgIdForCurrentUser());

    if (!orgId) {
      alert("No organization found for this admin user.");
      return;
    }

    if (!editAmount || Number(editAmount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("pledges")
      .update({
        amount_pledged: Number(editAmount),
        ...toAttributionIds(editAttribution),
        pledge_date: normalizeDateInput(editPledgeDate) || getTodayPlainDate(),
        frequency: editFrequency.toLowerCase().replace("-", "_"),
        status: pledgeStatusToDb(editStatus),
      })
      .eq("id", editingPledge.id)
      .eq("organization_id", orgId);

    setSavingEdit(false);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingPledge(null);
    await fetchPledges();

    if (selectedPledge?.id === editingPledge.id) {
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
          donorId: paymentPledge.donorId,
          contactId,
        });
      } catch (syncError) {
        console.warn("Donation affiliation sync failed:", syncError);
      }
    }

    setSavingPayment(false);

    resetPaymentForm();
    setShowPaymentDialog(false);

    await fetchPledges();
    await loadPledgePayments(paymentPledge.id, orgId);
    await refreshSelectedPledge(paymentPledge.id, orgId);
  };

  const fundFilterOptions = useMemo(() => {
    return Array.from(new Set(pledges.map((pledge) => pledge.fundName))).sort();
  }, [pledges]);

  const pledgeFundOptions = useMemo(() => {
    const options = fundOptions.length > 0 ? fundOptions : [{ id: "General Fund", name: "General Fund" }];

    if (!options.some((option) => option.name === "General Fund")) {
      return [{ id: "General Fund", name: "General Fund" }, ...options];
    }

    return options;
  }, [fundOptions]);

  const filteredPledges = pledges.filter((pledge) => {
    const matchesSearch = pledge.donorName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || pledge.status === statusFilter;
    const matchesFund = fundFilter === "all" || pledge.fundName === fundFilter;

    return matchesSearch && matchesStatus && matchesFund;
  });

  const totalPledged = summaryMetrics.totalPledged;
  const totalCollected = summaryMetrics.totalCollected;
  const totalRemaining = summaryMetrics.outstandingBalance;
  const activePledges = summaryMetrics.activePledgeCount;

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

  const filteredDonorOptions = donorOptions;

  return (
    <>
      <Header title="Pledges" />

      <div className="p-6">
        <div className="mb-6 flex flex-wrap gap-4 [&>*]:w-fit">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pledged
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPledged)}</div>
              <p className="text-xs text-muted-foreground">Across {totalPledges} pledges</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Collected
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCollected)}</div>
              <p className="text-xs text-muted-foreground">
                {totalPledged > 0 ? Math.round((totalCollected / totalPledged) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Remaining
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRemaining)}</div>
              <p className="text-xs text-muted-foreground">Yet to be collected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Pledges
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePledges}</div>
              <p className="text-xs text-muted-foreground">Not yet fulfilled</p>
            </CardContent>
          </Card>
        </div>

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

            <Select value={fundFilter} onValueChange={setFundFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Fund" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Funds</SelectItem>
                {fundFilterOptions.map((fund) => (
                  <SelectItem key={fund} value={fund}>
                    {fund}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pledge
          </Button>
        </div>

        <Card>
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
                  <TableHead>Fund</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading pledges...
                    </TableCell>
                  </TableRow>
                ) : filteredPledges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No pledges found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPledges.map((pledge) => (
                    <TableRow
                      key={pledge.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedPledge(pledge)}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium">{pledge.donorName}</span>
                          <p className="text-sm text-muted-foreground">{pledge.donorType}</p>
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
                        <Badge variant="outline">{pledge.fundName}</Badge>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setSelectedPledge(pledge);
                              }}
                            >
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setPaymentPledge(pledge);
                                setShowPaymentDialog(true);
                              }}
                            >
                              Record Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openEditPledge(pledge);
                              }}
                            >
                              Edit Pledge
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setSelectedPledge(pledge);
                              }}
                            >
                              Collection / Reminder
                            </DropdownMenuItem>
                            <DropdownMenuItem
  className="text-red-600"
  onClick={(event) => {
    event.preventDefault()
    event.stopPropagation()
    handleDeletePledge(pledge.id)
  }}
>
  Delete Pledge
</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
              <Label htmlFor="donor">Donor</Label>
              <Input
                id="donor"
                placeholder="Search contact by name or email..."
                value={donorSearch}
                onFocus={() => setShowDonorList(true)}
                onChange={async (event) => {
                  const value = event.target.value;

                  setDonorSearch(value);
                  setShowDonorList(true);

                  await searchDonors(value.trim());
                }}
              />

              {selectedContactId && (
                <div className="text-sm text-muted-foreground">
                  Selected:{" "}
                  <span className="font-medium">
                    {donorOptions.find((donor) => donor.contact_id === selectedContactId)?.full_name ||
                      donorOptions.find((donor) => donor.contact_id === selectedContactId)?.email}
                  </span>
                </div>
              )}

              {showDonorList && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {filteredDonorOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No donors found.
                    </div>
                  ) : (
                    filteredDonorOptions.map((donor) => (
                      <button
                        key={donor.id}
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                          selectedContactId === donor.contact_id ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => {
                          setSelectedContactId(donor.contact_id);
                          setDonorSearch(donor.full_name || donor.email || "");
                          setShowDonorList(false);
                        }}
                      >
                        {donor.full_name || donor.email || "Unnamed donor"}
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

      <Dialog open={!!editingPledge} onOpenChange={(open) => !open && setEditingPledge(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Pledge</DialogTitle>
            <DialogDescription>Update pledge details without changing the donor.</DialogDescription>
          </DialogHeader>

          {editingPledge && (
            <div className="flex flex-col gap-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground">Donor</p>
                <p className="font-medium">{editingPledge.donorName}</p>
              </div>

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
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pledge Details</DialogTitle>
            <DialogDescription>View and manage pledge information</DialogDescription>
          </DialogHeader>

          {selectedPledge && (
            <div className="flex-1 overflow-y-auto flex flex-col gap-6 py-4 pr-2">
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(selectedPledge.status)}
                <Badge variant="outline">{selectedPledge.fundName}</Badge>
                <Badge variant="secondary">{selectedPledge.frequency}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">
                    {formatCurrency(selectedPledge.amount_pledged)}
                  </p>
                  <p className="text-xs text-muted-foreground">Amount Pledged</p>
                </div>

                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(selectedPledge.amount_paid)}
                  </p>
                  <p className="text-xs text-muted-foreground">Amount Paid</p>
                </div>

                <div className="rounded-lg border p-4 text-center">
                  <p
                    className={`text-2xl font-bold ${
                      selectedPledge.balance_remaining > 0 ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    {formatCurrency(selectedPledge.balance_remaining)}
                  </p>
                  <p className="text-xs text-muted-foreground">Balance</p>
                </div>
              </div>

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
                  <span className="font-medium">{selectedPledge.donorName}</span>
                  <span className="text-sm text-muted-foreground">{selectedPledge.donorType}</span>
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
  <Button variant="outline" asChild>
  <Link
    href={
      selectedPledge?.contactId
        ? `/contacts/${selectedPledge.contactId}`
        : "/contacts"
    }
  >
    View Donor
  </Link>
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
    </>
  );
}

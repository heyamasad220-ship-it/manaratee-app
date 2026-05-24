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

type calculated_status = "Open" | "Partial" | "Fulfilled";

type DonationPledgeRow = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  donor_name: string | null;
  amount: number | string | null;
  amount_paid: number | string | null;
  status: string | null;
  fund_name: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
};

interface Pledge {
  id: string;
  contactId: string | null;
  donorName: string;
  donorType: string;
  amount_pledged: number;
  amount_paid: number;
  balance_remaining: number;
  frequency: string;
  startDate: string;
  nextPayment: string | null;
  status: calculated_status;
  fundName: string;
  notes?: string;
}

interface ContactOption {
  id: string;
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

function mapStatus(status: string | null, amount: number, paid: number): calculated_status {
  const normalized = status?.toLowerCase();

  if (normalized === "fulfilled" || normalized === "paid") return "Fulfilled";
  if (normalized === "partial" || normalized === "partially_paid") return "Partial";

  if (amount > 0 && paid >= amount) return "Fulfilled";
  if (paid > 0) return "Partial";

  return "Open";
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

function pledgeFromRow(row: any): Pledge {
  return {
    id: row.id,
    contactId: null,
    donorName: row.donor_name || "Unknown donor",
    donorType: "Donor",
    amount_pledged: Number(row.amount_pledged || 0),
    amount_paid: Number(row.amount_paid || 0),
    balance_remaining: Number(row.balance_remaining || 0),
    frequency: row.frequency || "One-Time",
    startDate: normalizeDateInput(row.pledge_date) || "",
    nextPayment: null,
    status: mapStatus(
      row.calculated_status,
      Number(row.amount_pledged || 0),
      Number(row.amount_paid || 0)
    ),
    fundName: row.campaign_name || "General Fund",
    notes: row.notes || undefined,
  };
}

export default function PledgesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [showDonorList, setShowDonorList] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactId, setContactId] = useState("");

  const [fundOptions, setFundOptions] = useState<FundOption[]>([]);

  const [campaignId, setCampaignId] = useState("");
  const [amount, setAmount] = useState("");
  const [pledgeDate, setPledgeDate] = useState("");
  const [frequency, setFrequency] = useState("One-Time");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editAmount, setEditAmount] = useState("");
  const [editFundName, setEditFundName] = useState("");
  const [editPledgeDate, setEditPledgeDate] = useState("");
  const [editFrequency, setEditFrequency] = useState("One-Time");
  const [editStatus, setEditStatus] = useState<calculated_status>("Open");
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

    if (!["owner", "admin"].includes(profile.role || "")) return null;

    return profile.organization_id as string;
  }

  async function searchContacts(searchValue: string, orgIdOverride?: string) {
    const orgId = orgIdOverride || organizationId;

    if (!orgId) return;

    let query = supabase
      .from("donors")
      .select("id, full_name, email")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true })
      .limit(50);

    if (searchValue.trim().length >= 1) {
      const cleanSearch = searchValue.trim().replaceAll(",", "").replaceAll("%", "");
      query = query.or(`full_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error searching contacts:", JSON.stringify(error, null, 2));
      setContacts([]);
      return;
    }

    setContacts((data || []) as ContactOption[]);
  }
async function handleDeletePledge(pledgeId: string) {
  if (!confirm("Delete this pledge? Related payments will stay in Payments but will be unallocated from this pledge.")) return

  const orgId = organizationId || (await getOrgIdForCurrentUser())

  if (!orgId) {
    alert("No organization found.")
    return
  }

  const { error: unlinkPaymentsError } = await supabase
    .from("payments")
    .update({ pledge_id: null })
    .eq("pledge_id", pledgeId)
    .eq("organization_id", orgId)

  if (unlinkPaymentsError) {
    alert(unlinkPaymentsError.message)
    return
  }

  const { error: pledgeError } = await supabase
    .from("pledge_status_view")
    .delete()
    .eq("id", pledgeId)
    .eq("organization_id", orgId)

  if (pledgeError) {
    alert(pledgeError.message)
    return
  }

  setSelectedPledge(null)
  setPaymentPledge(null)
  setPledgePayments([])

  await fetchPledges()
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

  const fetchPledges = async () => {
    setLoading(true);

    const orgId = await getOrgIdForCurrentUser();

    if (!orgId) {
      setOrganizationId(null);
      setPledges([]);
      setContacts([]);
      setFundOptions([]);
      setLoading(false);
      return;
    }

    setOrganizationId(orgId);

    await searchContacts("", orgId);

    const { data: pledgeData, error: pledgeError } = await supabase
  .from("pledge_status_view")
  .select(
    "id, organization_id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, frequency, pledge_date, notes"
  )
  .eq("organization_id", orgId)
  .order("pledge_date", { ascending: false });
    if (pledgeError) {
      console.error("Error loading donation pledges:", pledgeError);
      setPledges([]);
      setLoading(false);
      return;
    }

    const mapped = (pledgeData || []).map(pledgeFromRow);

    setPledges(mapped);
    await loadFundOptions(orgId, mapped);
    setLoading(false);
  };

  const loadPledgePayments = async (pledgeId: string, orgId: string) => {
    setLoadingPledgePayments(true);
    setPledgePaymentsError(null);

    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, payment_date, source, payment_method")
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
      source: payment.payment_method || payment.source,
      memo: null,
    }));

    setPledgePayments(mappedPayments);
    setLoadingPledgePayments(false);
  };

  useEffect(() => {
    fetchPledges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setContactId("");
    setCampaignId("");
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
    setEditFundName(pledge.fundName || "General Fund");
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

    if (!contactId) {
      alert("Please select a contact.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const selectedContact = contacts.find((contact) => contact.id === contactId);

    setSaving(true);

    const { error } = await supabase.from("pledges").insert({
  organization_id: orgId,
  donor_id: contactId,
  campaign_id: campaignId || null,
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
      .from("donation_pledges")
      .select(
        "id, organization_id, contact_id, donor_name, amount, amount_paid, status, fund_name, frequency, start_date, end_date"
      )
      .eq("organization_id", orgId)
      .eq("id", pledgeId)
      .single();

    if (error || !data) return;

    const updatedPledge = pledgeFromRow(data as DonationPledgeRow);

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
      .from("donation_pledges")
      .update({
        amount: Number(editAmount),
        fund_name: editFundName || "General Fund",
        frequency: editFrequency,
        start_date: normalizeDateInput(editPledgeDate) || getTodayPlainDate(),
        status: editStatus,
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

    const newPaidAmount = Number(paymentPledge.amount_paid || 0) + Number(paymentAmount || 0);
    const newStatus =
      newPaidAmount >= Number(paymentPledge.amount_pledged || 0)
        ? "Fulfilled"
        : newPaidAmount > 0
          ? "Partial"
          : "Open";

    const { error: paymentError } = await supabase.from("payments").insert({
      organization_id: orgId,
      contact_id: paymentPledge.contactId,
      pledge_id: paymentPledge.id,
      donor_name: paymentPledge.donorName,
      amount: Number(paymentAmount),
      payment_date: normalizeDateInput(paymentDate) || getTodayPlainDate(),
      source: paymentSource,
      payment_method: paymentSource,
      fund_name: paymentPledge.fundName,
      status: "Allocated",
    });

    if (paymentError) {
      setSavingPayment(false);
      alert(paymentError.message);
      return;
    }

    const { error: pledgeUpdateError } = await supabase
      .from("donation_pledges")
      .update({
        amount_paid: newPaidAmount,
        status: newStatus,
      })
      .eq("id", paymentPledge.id)
      .eq("organization_id", orgId);

    setSavingPayment(false);

    if (pledgeUpdateError) {
      alert(pledgeUpdateError.message);
      return;
    }

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

  const totalPledged = pledges.reduce((sum, pledge) => sum + pledge.amount_pledged, 0);
  const totalCollected = pledges.reduce((sum, pledge) => sum + pledge.amount_paid, 0);
  const totalRemaining = pledges.reduce((sum, pledge) => sum + pledge.balance_remaining, 0);
  const activePledges = pledges.filter((pledge) => pledge.status !== "Fulfilled").length;

  const getStatusBadge = (status: calculated_status) => {
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

  const filteredContactOptions = contacts;

  return (
    <>
      <Header title="Pledges" />

      <div className="p-6">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pledged
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPledged)}</div>
              <p className="text-xs text-muted-foreground">Across {pledges.length} pledges</p>
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
                            <DropdownMenuItem>Send Reminder</DropdownMenuItem>
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

                  await searchContacts(value.trim());
                }}
              />

              {contactId && (
                <div className="text-sm text-muted-foreground">
                  Selected:{" "}
                  <span className="font-medium">
                    {contacts.find((contact) => contact.id === contactId)?.full_name ||
                      contacts.find((contact) => contact.id === contactId)?.email}
                  </span>
                </div>
              )}

              {showDonorList && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {filteredContactOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No contacts found.
                    </div>
                  ) : (
                    filteredContactOptions.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                          contactId === contact.id ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => {
                          setContactId(contact.id);
                          setDonorSearch(contact.full_name || contact.email || "");
                          setShowDonorList(false);
                        }}
                      >
                        {contact.full_name || contact.email || "Unnamed contact"}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="fund">Fund</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger id="fund">
                    <SelectValue placeholder="Select a campaign or fund" />
                  </SelectTrigger>
                  <SelectContent>
                    {pledgeFundOptions.map((fund) => (
                      <SelectItem key={fund.id} value={fund.id}>
                        {fund.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
              <p className="text-xs text-muted-foreground">
                Notes are not saved yet because the shared donation_pledges table does not currently have a notes column.
              </p>
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

                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-fund">Fund</Label>
                  <Select value={editFundName || "General Fund"} onValueChange={setEditFundName}>
                    <SelectTrigger id="edit-fund">
                      <SelectValue placeholder="Select a campaign or fund" />
                    </SelectTrigger>
                    <SelectContent>
                      {pledgeFundOptions.map((fund) => (
                        <SelectItem key={fund.id} value={fund.id}>
                          {fund.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Select value={editStatus} onValueChange={(value) => setEditStatus(value as calculated_status)}>
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
                <p className="text-xs text-muted-foreground">
                  Memo is not saved yet because the shared donation_payments table does not currently have a memo column.
                </p>
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

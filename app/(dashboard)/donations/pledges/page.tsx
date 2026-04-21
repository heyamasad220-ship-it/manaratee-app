"use client";

import { PaymentHistory } from "@/components/donations/payment-history";
import { getCurrentOrganizationId } from "@/lib/current-organization";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type PledgeStatus = "Open" | "Partial" | "Fulfilled";

interface PledgeRow {
  id: string;
  donor_name: string;
  donor_type: string | null;
  campaign_name: string | null;
  campaign_code: string | null;
  amount_pledged: number;
  amount_paid: number;
  balance_remaining: number;
  payment_status: string;
  pledge_date: string | null;
}

interface Pledge {
  id: string;
  donorName: string;
  donorType: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  frequency: string;
  startDate: string;
  endDate: string;
  nextPayment: string | null;
  status: PledgeStatus;
  campaign: string;
  notes?: string;
}

interface DonorOption {
  id: string;
  full_name: string;
}

interface CampaignOption {
  id: string;
  name: string;
}

type PaymentHistoryItem = {
  id: string;
  amount: number | string;
  payment_date: string | null;
  source: string | null;
  memo: string | null;
};

function mapStatus(status: string): PledgeStatus {
  const normalized = status?.toLowerCase();
  if (normalized === "fulfilled" || normalized === "paid") return "Fulfilled";
  if (normalized === "partial" || normalized === "partially_paid") return "Partial";
  return "Open";
}

function formatDonorType(value: string | null): string {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function PledgesPage() {
  const supabase = createClient();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const [selectedPledge, setSelectedPledge] = useState<Pledge | null>(null);
  const [paymentPledge, setPaymentPledge] = useState<Pledge | null>(null);

  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);

  const [pledgePayments, setPledgePayments] = useState<PaymentHistoryItem[]>([]);
  const [loadingPledgePayments, setLoadingPledgePayments] = useState(false);
  const [pledgePaymentsError, setPledgePaymentsError] = useState<string | null>(null);

  const [donors, setDonors] = useState<DonorOption[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);

  const [donorId, setDonorId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [amount, setAmount] = useState("");
  const [pledgeDate, setPledgeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentSource, setPaymentSource] = useState("cash");
  const [paymentMemo, setPaymentMemo] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const fetchPledges = async () => {
    setLoading(true);

    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      console.error("No selected organization");
      setOrganizationId(null);
      setPledges([]);
      setDonors([]);
      setCampaignOptions([]);
      setLoading(false);
      return;
    }

    setOrganizationId(orgId);

    const { data: donorsData, error: donorsError } = await supabase
      .from("donors")
      .select("id, full_name")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true });

    if (donorsError) {
      console.error("Error loading donors:", donorsError);
      setDonors([]);
    } else {
      setDonors((donorsData || []) as DonorOption[]);
    }

    const { data: campaignsData, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (campaignsError) {
      console.error("Error loading campaigns:", campaignsError);
      setCampaignOptions([]);
    } else {
      setCampaignOptions((campaignsData || []) as CampaignOption[]);
    }

    const { data, error } = await supabase
      .from("pledge_status_view")
      .select(`
        id,
        donor_name,
        donor_type,
        campaign_name,
        campaign_code,
        amount_pledged,
        amount_paid,
        balance_remaining,
        payment_status,
        pledge_date
      `)
      .eq("organization_id", orgId)
      .order("donor_name", { ascending: true });

    if (error) {
      console.error("Error loading pledges:", error);
      setPledges([]);
      setLoading(false);
      return;
    }

    const mapped: Pledge[] = (data as PledgeRow[]).map((row) => ({
      id: row.id,
      donorName: row.donor_name,
      donorType: formatDonorType(row.donor_type),
      totalAmount: Number(row.amount_pledged ?? 0),
      paidAmount: Number(row.amount_paid ?? 0),
      balance: Number(row.balance_remaining ?? 0),
      frequency: "One-Time",
      startDate: row.pledge_date ?? new Date().toISOString(),
      endDate: row.pledge_date ?? new Date().toISOString(),
      nextPayment: null,
      status: mapStatus(row.payment_status),
      campaign: row.campaign_name ?? row.campaign_code ?? "No Campaign",
      notes: undefined,
    }));

    setPledges(mapped);
    setLoading(false);
  };

  const loadPledgePayments = async (pledgeId: string, orgId: string) => {
    setLoadingPledgePayments(true);
    setPledgePaymentsError(null);

    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, payment_date, source, memo, created_at")
      .eq("organization_id", orgId)
      .eq("pledge_id", pledgeId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading pledge payments:", error);
      setPledgePayments([]);
      setPledgePaymentsError("Could not load payment history");
      setLoadingPledgePayments(false);
      return;
    }

    setPledgePayments((data ?? []) as PaymentHistoryItem[]);
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
    setDonorId("");
    setCampaignId("");
    setAmount("");
    setPledgeDate("");
    setNotes("");
  };

  const resetPaymentForm = () => {
    setPaymentAmount("");
    setPaymentDate("");
    setPaymentSource("cash");
    setPaymentMemo("");
  };

  const handleAddPledge = async () => {
    const orgId = organizationId || (await getCurrentOrganizationId());

    if (!orgId) {
      alert("No organization selected");
      return;
    }

    if (!donorId) {
      alert("Please select a donor");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("pledges").insert({
      organization_id: orgId,
      donor_id: donorId,
      campaign_id: campaignId || null,
      amount_pledged: Number(amount),
      pledge_date: pledgeDate || null,
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

  const handleRecordPayment = async () => {
    if (!paymentPledge) return;

    const orgId = organizationId || (await getCurrentOrganizationId());

    if (!orgId) {
      alert("No organization selected");
      return;
    }

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert("Enter valid amount");
      return;
    }

    setSavingPayment(true);

    const { error } = await supabase.from("payments").insert({
      organization_id: orgId,
      donor_id: null,
      pledge_id: paymentPledge.id,
      campaign_id: null,
      amount: Number(paymentAmount),
      payment_date: paymentDate
        ? `${paymentDate}T12:00:00`
        : new Date().toISOString(),
      source: paymentSource,
      source_type: "manual",
      memo: paymentMemo || null,
      status: "allocated",
      is_verified: true,
    });

    setSavingPayment(false);

    if (error) {
      alert(error.message);
      return;
    }

    resetPaymentForm();
    setShowPaymentDialog(false);

    await fetchPledges();
    await loadPledgePayments(paymentPledge.id, orgId);

    const { data: updatedPledgeRow, error: updatedPledgeError } = await supabase
      .from("pledge_status_view")
      .select(`
        id,
        donor_name,
        donor_type,
        campaign_name,
        campaign_code,
        amount_pledged,
        amount_paid,
        balance_remaining,
        payment_status,
        pledge_date
      `)
      .eq("organization_id", orgId)
      .eq("id", paymentPledge.id)
      .single();

    if (updatedPledgeError) {
      console.error("Error reloading updated pledge:", updatedPledgeError);
      return;
    }

    const updatedPledge: Pledge = {
      id: updatedPledgeRow.id,
      donorName: updatedPledgeRow.donor_name,
      donorType: formatDonorType(updatedPledgeRow.donor_type),
      totalAmount: Number(updatedPledgeRow.amount_pledged ?? 0),
      paidAmount: Number(updatedPledgeRow.amount_paid ?? 0),
      balance: Number(updatedPledgeRow.balance_remaining ?? 0),
      frequency: "One-Time",
      startDate: updatedPledgeRow.pledge_date ?? new Date().toISOString(),
      endDate: updatedPledgeRow.pledge_date ?? new Date().toISOString(),
      nextPayment: null,
      status: mapStatus(updatedPledgeRow.payment_status),
      campaign:
        updatedPledgeRow.campaign_name ??
        updatedPledgeRow.campaign_code ??
        "No Campaign",
      notes: paymentPledge.notes,
    };

    setSelectedPledge(updatedPledge);
    setPaymentPledge(updatedPledge);
  };

  const campaignFilterOptions = useMemo(() => {
    return Array.from(new Set(pledges.map((p) => p.campaign))).sort();
  }, [pledges]);

  const filteredPledges = pledges.filter((pledge) => {
    const matchesSearch = pledge.donorName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || pledge.status === statusFilter;
    const matchesCampaign = campaignFilter === "all" || pledge.campaign === campaignFilter;
    return matchesSearch && matchesStatus && matchesCampaign;
  });

  const totalPledged = pledges.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalCollected = pledges.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalRemaining = pledges.reduce((sum, p) => sum + p.balance, 0);
  const activePledges = pledges.filter((p) => p.status !== "Fulfilled").length;

  const getStatusBadge = (status: PledgeStatus) => {
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
              <div className="text-2xl font-bold">${totalPledged.toLocaleString()}</div>
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
              <div className="text-2xl font-bold">${totalCollected.toLocaleString()}</div>
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
              <div className="text-2xl font-bold">${totalRemaining.toLocaleString()}</div>
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
                onChange={(e) => setSearch(e.target.value)}
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

            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaignFilterOptions.map((campaign) => (
                  <SelectItem key={campaign} value={campaign}>
                    {campaign}
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
                  <TableHead>Campaign</TableHead>
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
                        ${pledge.totalAmount.toLocaleString()}
                      </TableCell>

                      <TableCell className="font-medium text-emerald-600">
                        ${pledge.paidAmount.toLocaleString()}
                      </TableCell>

                      <TableCell
                        className={
                          pledge.balance > 0
                            ? "font-medium text-amber-600"
                            : "text-muted-foreground"
                        }
                      >
                        ${pledge.balance.toLocaleString()}
                      </TableCell>

                      <TableCell>{getStatusBadge(pledge.status)}</TableCell>

                      <TableCell>
                        <Badge variant="outline">{pledge.campaign}</Badge>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedPledge(pledge)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPaymentPledge(pledge);
                                setShowPaymentDialog(true);
                              }}
                            >
                              Record Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit Pledge</DropdownMenuItem>
                            <DropdownMenuItem>Send Reminder</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              Cancel Pledge
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
              <Select value={donorId} onValueChange={setDonorId}>
                <SelectTrigger id="donor">
                  <SelectValue placeholder="Select donor" />
                </SelectTrigger>
                <SelectContent>
                  {donors.map((donor) => (
                    <SelectItem key={donor.id} value={donor.id}>
                      {donor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="campaign">Campaign</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger id="campaign">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignOptions.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
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
                  onChange={(e) => setPledgeDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pledge-type">Pledge Type</Label>
                <Input id="pledge-type" value="One-Time" disabled />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
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
                  onChange={(e) => setPaymentMemo(e.target.value)}
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
                <Badge variant="outline">{selectedPledge.campaign}</Badge>
                <Badge variant="secondary">{selectedPledge.frequency}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">${selectedPledge.totalAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Amount Pledged</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    ${selectedPledge.paidAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Amount Paid</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p
                    className={`text-2xl font-bold ${
                      selectedPledge.balance > 0 ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    ${selectedPledge.balance.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Balance</p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">
                    {selectedPledge.totalAmount > 0
                      ? Math.round((selectedPledge.paidAmount / selectedPledge.totalAmount) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    selectedPledge.totalAmount > 0
                      ? (selectedPledge.paidAmount / selectedPledge.totalAmount) * 100
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
                    {selectedPledge.nextPayment
                      ? new Date(selectedPledge.nextPayment).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Start Date</span>
                  <span className="font-medium">
                    {new Date(selectedPledge.startDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">End Date</span>
                  <span className="font-medium">
                    {new Date(selectedPledge.endDate).toLocaleDateString()}
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
            <Button variant="outline" onClick={() => setSelectedPledge(null)}>
              Close
            </Button>
            <Button variant="outline" asChild>
              <Link href="/donations/donors">View Donor</Link>
            </Button>
            <Button
              onClick={() => {
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
"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { getCurrentOrganizationId } from "@/lib/current-organization";
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
import { Plus } from "lucide-react";

type Payment = {
  id: string;
  amount: number;
  payment_date: string | null;
  source: string | null;
  memo: string | null;
  pledge_id: string | null;
  donor_id: string | null;
  campaign_id: string | null;
  status: string | null;
  donors: { full_name: string } | null;
  campaigns: { name: string } | null;
};

type DonorOption = {
  id: string;
  full_name: string;
};

type CampaignOption = {
  id: string;
  name: string;
};

type PledgeOption = {
  id: string;
  donor_name: string;
  campaign_name: string | null;
  amount_pledged: number;
  amount_paid: number;
  balance_remaining: number;
  donor_id: string | null;
  campaign_id: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(date: string | null) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStatus(status: string | null) {
  if (!status) return "—";
  return status.replaceAll("_", " ");
}

export default function PaymentsPage() {
  const supabase = createClient();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [donors, setDonors] = useState<DonorOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [donorId, setDonorId] = useState("none");
  const [campaignId, setCampaignId] = useState("none");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [source, setSource] = useState("cash");
  const [memo, setMemo] = useState("");
  const [pledges, setPledges] = useState<PledgeOption[]>([]);
  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedPledgeId, setSelectedPledgeId] = useState("");
  const [allocating, setAllocating] = useState(false);
  const allocationPledges =
  selectedPayment?.donor_id
    ? pledges.filter((pledge) => pledge.donor_id === selectedPayment.donor_id)
    : pledges;

  async function loadPayments() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      setOrganizationId(null);
      setPayments([]);
      setDonors([]);
      setCampaigns([]);
      setLoading(false);
      return;
    }

    setOrganizationId(orgId);

    const { data: donorData, error: donorError } = await supabase
      .from("donors")
      .select("id, full_name")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true });

    if (donorError) {
      console.error("Error loading donors:", donorError);
      setDonors([]);
    } else {
      setDonors((donorData ?? []) as DonorOption[]);
    }

    const { data: campaignData, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (campaignError) {
      console.error("Error loading campaigns:", campaignError);
      setCampaigns([]);
    } else {
      setCampaigns((campaignData ?? []) as CampaignOption[]);
    }
    const { data: pledgeData, error: pledgeLoadError } = await supabase
  .from("pledge_status_view")
  .select(`
    id,
    donor_name,
    campaign_name,
    amount_pledged,
    amount_paid,
    balance_remaining,
    donor_id
  `)
  .eq("organization_id", orgId)
  .order("donor_name", { ascending: true });

if (pledgeLoadError) {
  console.error("Error loading pledges for allocation:", pledgeLoadError);
  setPledges([]);
} else {
  setPledges((pledgeData || []) as unknown as PledgeOption[]);
}
    const { data, error } = await supabase
      .from("payments")
      .select(`
  id,
  amount,
  payment_date,
  source,
  memo,
  pledge_id,
  donor_id,
  campaign_id,
  status,
  donors ( full_name ),
  campaigns ( name )
`)
      .eq("organization_id", orgId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading payments:", error);
      setPayments([]);
    } else {
      setPayments((data || []) as unknown as Payment[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setDonorId("none");
    setCampaignId("none");
    setAmount("");
    setPaymentDate("");
    setSource("cash");
    setMemo("");
  }

  async function handleAddPayment() {
    const orgId = organizationId || (await getCurrentOrganizationId());

    if (!orgId) {
      alert("No organization selected");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("payments").insert({
      organization_id: orgId,
      donor_id: donorId === "none" ? null : donorId,
      campaign_id: campaignId === "none" ? null : campaignId,
      pledge_id: null,
      amount: Number(amount),
      payment_date: paymentDate
        ? `${paymentDate}T12:00:00`
        : new Date().toISOString(),
      source,
      source_type: "manual",
      memo: memo || null,
      status: "unallocated",
      is_verified: true,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    resetForm();
    setShowAddDialog(false);
    setLoading(true);
    await loadPayments();
  }
async function handleAllocatePayment() {
  if (!selectedPayment) {
    alert("No payment selected");
    return;
  }

  if (!selectedPledgeId) {
    alert("Please select a pledge");
    return;
  }

  const selectedPledge = pledges.find((p) => p.id === selectedPledgeId);

  if (!selectedPledge) {
    alert("Selected pledge not found");
    return;
  }

  setAllocating(true);

  const { error } = await supabase
    .from("payments")
    .update({
      pledge_id: selectedPledge.id,
      donor_id: selectedPayment.donor_id ?? selectedPledge.donor_id ?? null,
      campaign_id: selectedPayment.campaign_id ?? selectedPledge.campaign_id ?? null,
      status: "allocated",
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
  setLoading(true);
  await loadPayments();
}
  return (
    <>
      <Header title="Payments" />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">All Payments</h2>
            <p className="text-sm text-muted-foreground">
              All recorded payments for this organization
            </p>
          </div>

          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        </div>

        <div className="rounded-lg border bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No payments found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Donor</th>
                    <th className="text-left p-3">Campaign</th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">Method</th>
                    <th className="text-left p-3">Pledge</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Memo</th>
                    <th className="text-left p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b">
                     <td className="p-3">{formatDate(p.payment_date)}</td>

<td className="p-3">
  {p.donors?.full_name || "—"}
</td>

<td className="p-3">
  {p.campaigns?.name || "—"}
</td>

<td className="p-3 font-medium">
  {formatCurrency(Number(p.amount || 0))}
</td>

<td className="p-3 capitalize">
  {p.source || "—"}
</td>

<td className="p-3">
  {p.pledge_id ? "Linked" : "Unlinked"}
</td>

<td className="p-3 capitalize">
  {formatStatus(p.status)}
</td>

<td className="p-3">
  {p.memo || "—"}
</td>
<td className="p-3">
  {!p.pledge_id ? (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        setSelectedPayment(p);
        setSelectedPledgeId("");
        setShowAllocateDialog(true);
      }}
    >
      Allocate
    </Button>
  ) : (
    <span className="text-muted-foreground">—</span>
  )}
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Add a standalone payment that is not tied to a pledge.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Donor</Label>
                <Select value={donorId} onValueChange={setDonorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select donor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No donor selected</SelectItem>
                    {donors.map((donor) => (
                      <SelectItem key={donor.id} value={donor.id}>
                        {donor.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Campaign</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No campaign selected</SelectItem>
                    {campaigns.map((campaign) => (
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
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
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
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Memo</Label>
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
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
      <DialogTitle>Allocate Payment</DialogTitle>
      <DialogDescription>
        Link this standalone payment to a pledge.
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
              <span className="font-medium capitalize">
                {selectedPayment.source || "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Donor:</span>{" "}
              <span className="font-medium">
                {selectedPayment.donors?.full_name || "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Campaign:</span>{" "}
              <span className="font-medium">
                {selectedPayment.campaigns?.name || "—"}
              </span>
            </div>
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
        {pledge.donor_name} — {pledge.campaign_name || "No Campaign"} — Balance:{" "}
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
        {allocating ? "Allocating..." : "Allocate Payment"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </>
  );
}
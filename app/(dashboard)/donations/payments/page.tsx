"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Check, ChevronsUpDown, Plus } from "lucide-react";

type Payment = {
  id: string;
  amount: number | string | null;
  payment_date: string | null;
  source: string | null;
  memo: string | null;
  pledge_id: string | null;
  donor_id: string | null;
  status: string | null;
  sender_name: string | null;
};

type DonorOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  donor_type: string | null;
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

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/^dr\.?\s+/i, "")
    .replace(/\s+[a-z]\.?\s+/gi, " ")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

export default function PaymentsPage() {
  const supabase = createClient();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [donors, setDonors] = useState<DonorOption[]>([]);
  const [pledges, setPledges] = useState<PledgeOption[]>([]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [donorId, setDonorId] = useState("none");
  const [donorOpen, setDonorOpen] = useState(false);
  const [donorSearch, setDonorSearch] = useState("");

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [source, setSource] = useState("cash");
  const [memo, setMemo] = useState("");

  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedPledgeId, setSelectedPledgeId] = useState("");
  const [allocating, setAllocating] = useState(false);

  const selectedDonorName = useMemo(() => {
    if (donorId === "none") return "No donor selected";

    const donor = donors.find((item) => item.id === donorId);

    return donor?.full_name || donor?.email || "No donor selected";
  }, [donorId, donors]);

  const uniqueDonors = donors.filter(
    (donor, index, self) =>
      index ===
      self.findIndex(
        (item) =>
          normalizeName(item.full_name || item.email || "") ===
          normalizeName(donor.full_name || donor.email || "")
      )
  );

  const filteredDonors = uniqueDonors.filter((donor) =>
    normalizeName(donor.full_name || donor.email || "").includes(
      normalizeName(donorSearch)
    )
  );

  const allocationPledges = selectedPayment?.donor_id
    ? pledges.filter((pledge) => pledge.donor_id === selectedPayment.donor_id)
    : pledges;

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

  async function loadPayments() {
    setLoading(true);

    const orgId = await getOrgIdForCurrentUser();

    if (!orgId) {
      setOrganizationId(null);
      setPayments([]);
      setDonors([]);
      setPledges([]);
      setLoading(false);
      return;
    }

    setOrganizationId(orgId);

    const { data: donorData, error: donorError } = await supabase
      .from("donors")
      .select("id, full_name, email, donor_type")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true });

    if (donorError) {
      console.error("Error loading donors:", donorError);
      setDonors([]);
    } else {
      setDonors((donorData || []) as DonorOption[]);
    }

    const { data: pledgeData, error: pledgeError } = await supabase
      .from("pledge_status_view")
      .select(
        "id, donor_id, donor_name, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status"
      )
      .eq("organization_id", orgId)
      .order("donor_name", { ascending: true });

    if (pledgeError) {
      console.error("Error loading pledges:", pledgeError);
      setPledges([]);
    } else {
      setPledges((pledgeData || []) as PledgeOption[]);
    }

    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, amount, payment_date, source, memo, pledge_id, donor_id, status, sender_name"
      )
      .eq("organization_id", orgId)
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("Error loading payments:", error);
      setPayments([]);
    } else {
      setPayments((data || []) as Payment[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setDonorId("none");
    setDonorOpen(false);
    setDonorSearch("");
    setAmount("");
    setPaymentDate("");
    setSource("cash");
    setMemo("");
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

    const selectedDonor =
      donorId === "none"
        ? null
        : donors.find((donor) => donor.id === donorId);

    setSaving(true);

    const { error } = await supabase.from("payments").insert({
      organization_id: orgId,
      donor_id: donorId === "none" ? null : donorId,
      pledge_id: null,
      sender_name: selectedDonor?.full_name || selectedDonor?.email || null,
      amount: Number(amount),
      payment_date: paymentDate ? `${paymentDate}T12:00:00` : new Date().toISOString(),
      source,
      source_type: "manual",
      memo: memo || null,
      status: donorId === "none" ? "pending_review" : "unallocated",
      is_verified: false,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
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

    const { error } = await supabase
      .from("payments")
      .update({
        pledge_id: selectedPledge.id,
        donor_id: selectedPayment.donor_id || selectedPledge.donor_id || null,
        status: "allocated",
        reconciled_at: new Date().toISOString(),
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

  function getPaymentDonorName(payment: Payment) {
    const donor = payment.donor_id
      ? donors.find((item) => item.id === payment.donor_id)
      : null;

    return donor?.full_name || donor?.email || payment.sender_name || "—";
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
            <div className="p-6 text-sm text-muted-foreground">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No payments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Donor / Sender</th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">Method</th>
                    <th className="text-left p-3">Pledge</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Memo</th>
                    <th className="text-left p-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="p-3">{formatDate(payment.payment_date)}</td>

                      <td className="p-3">{getPaymentDonorName(payment)}</td>

                      <td className="p-3 font-medium">
                        {formatCurrency(Number(payment.amount || 0))}
                      </td>

                      <td className="p-3 capitalize">
                        {payment.source || "—"}
                      </td>

                      <td className="p-3">{payment.pledge_id ? "Linked" : "Unlinked"}</td>

                      <td className="p-3 capitalize">{formatStatus(payment.status)}</td>

                      <td className="p-3">{payment.memo || "—"}</td>

                      <td className="p-3">
                        {!payment.pledge_id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayment(payment);
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
              Add a standalone donation payment for this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Donor</Label>

              <Popover open={donorOpen} onOpenChange={setDonorOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={donorOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedDonorName}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search donor name..."
                      value={donorSearch}
                      onValueChange={setDonorSearch}
                    />

                    <CommandList>
                      <CommandEmpty>No donor found.</CommandEmpty>

                      <CommandGroup>
                        <CommandItem
                          value="No donor selected"
                          onSelect={() => {
                            setDonorId("none");
                            setDonorOpen(false);
                            setDonorSearch("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              donorId === "none" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          No donor selected
                        </CommandItem>

                        {filteredDonors.map((donor) => (
                          <CommandItem
                            key={donor.id}
                            value={donor.full_name || donor.email || donor.id}
                            onSelect={() => {
                              setDonorId(donor.id);
                              setDonorOpen(false);
                              setDonorSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                donorId === donor.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {donor.full_name || donor.email || "Unnamed donor"}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

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
            <DialogTitle>Allocate Payment</DialogTitle>
            <DialogDescription>Link this standalone payment to a pledge.</DialogDescription>
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
                    <span className="text-muted-foreground">Donor / Sender:</span>{" "}
                    <span className="font-medium">{getPaymentDonorName(selectedPayment)}</span>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Memo:</span>{" "}
                    <span className="font-medium">{selectedPayment.memo || "—"}</span>
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
              {allocating ? "Allocating..." : "Allocate Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
  amount: number;
  payment_date: string | null;
  source: string | null;
  payment_method: string | null;
  fund_name: string | null;
  pledge_id: string | null;
  contact_id: string | null;
  status: string | null;
  donor_name: string | null;
};

type ContactOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type PledgeOption = {
  id: string;
  donor_name: string | null;
  amount: number;
  collected_amount: number | null;
  fund_name: string | null;
  contact_id: string | null;
  status: string | null;
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

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [pledges, setPledges] = useState<PledgeOption[]>([]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [contactId, setContactId] = useState("none");
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const [fundName, setFundName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [source, setSource] = useState("cash");
  const [memo, setMemo] = useState("");

  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedPledgeId, setSelectedPledgeId] = useState("");
  const [allocating, setAllocating] = useState(false);

  const selectedContactName = useMemo(() => {
    if (contactId === "none") return "No donor selected";

    const contact = contacts.find((item) => item.id === contactId);

    return contact?.full_name || contact?.email || "No donor selected";
  }, [contactId, contacts]);

  const uniqueContacts = contacts.filter(
    (contact, index, self) =>
      index ===
      self.findIndex(
        (item) =>
          normalizeName(item.full_name || item.email || "") ===
          normalizeName(contact.full_name || contact.email || "")
      )
  );

  const filteredContacts = uniqueContacts.filter((contact) =>
    normalizeName(contact.full_name || contact.email || "").includes(
      normalizeName(contactSearch)
    )
  );

  const allocationPledges = selectedPayment?.contact_id
    ? pledges.filter((pledge) => pledge.contact_id === selectedPayment.contact_id)
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
      setContacts([]);
      setPledges([]);
      setLoading(false);
      return;
    }

    setOrganizationId(orgId);

    const { data: contactData, error: contactError } = await supabase
      .from("contacts")
      .select("id, full_name, email")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true });

    if (contactError) {
      console.error("Error loading contacts:", contactError);
      setContacts([]);
    } else {
      setContacts((contactData || []) as ContactOption[]);
    }

    const { data: pledgeData, error: pledgeError } = await supabase
      .from("donation_pledges")
      .select("id, donor_name, amount, collected_amount, fund_name, contact_id, status")
      .eq("organization_id", orgId)
      .order("donor_name", { ascending: true });

    if (pledgeError) {
      console.error("Error loading pledges:", pledgeError);
      setPledges([]);
    } else {
      setPledges((pledgeData || []) as PledgeOption[]);
    }

    const { data, error } = await supabase
      .from("donation_payments")
      .select(
        "id, amount, payment_date, source, payment_method, fund_name, pledge_id, contact_id, status, donor_name"
      )
      .eq("organization_id", orgId)
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("Error loading donation payments:", error);
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
    setContactId("none");
    setContactOpen(false);
    setContactSearch("");
    setFundName("");
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

    const selectedContact =
      contactId === "none"
        ? null
        : contacts.find((contact) => contact.id === contactId);

    setSaving(true);

    const { error } = await supabase.from("donation_payments").insert({
      organization_id: orgId,
      contact_id: contactId === "none" ? null : contactId,
      pledge_id: null,
      donor_name: selectedContact?.full_name || selectedContact?.email || null,
      amount: Number(amount),
      payment_date: paymentDate ? `${paymentDate}T12:00:00` : new Date().toISOString(),
      source,
      payment_method: source,
      fund_name: fundName || null,
      status: "Unallocated",
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
      .from("donation_payments")
      .update({
        pledge_id: selectedPledge.id,
        contact_id: selectedPayment.contact_id || selectedPledge.contact_id || null,
        donor_name: selectedPayment.donor_name || selectedPledge.donor_name || null,
        fund_name: selectedPayment.fund_name || selectedPledge.fund_name || null,
        status: "Allocated",
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
                    <th className="text-left p-3">Donor</th>
                    <th className="text-left p-3">Fund</th>
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
                      <td className="p-3">{payment.donor_name || "—"}</td>
                      <td className="p-3">{payment.fund_name || "—"}</td>
                      <td className="p-3 font-medium">
                        {formatCurrency(Number(payment.amount || 0))}
                      </td>
                      <td className="p-3 capitalize">
                        {payment.payment_method || payment.source || "—"}
                      </td>
                      <td className="p-3">{payment.pledge_id ? "Linked" : "Unlinked"}</td>
                      <td className="p-3 capitalize">{formatStatus(payment.status)}</td>
                      <td className="p-3">—</td>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Donor</Label>
                <Popover open={contactOpen} onOpenChange={setContactOpen} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">{selectedContactName}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search donor name..."
                        value={contactSearch}
                        onValueChange={setContactSearch}
                      />

                      <CommandList>
                        <CommandEmpty>No donor found.</CommandEmpty>

                        <CommandGroup>
                          <CommandItem
                            value="No donor selected"
                            onSelect={() => {
                              setContactId("none");
                              setContactOpen(false);
                              setContactSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                contactId === "none" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            No donor selected
                          </CommandItem>

                          {filteredContacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={contact.full_name || contact.email || contact.id}
                              onSelect={() => {
                                setContactId(contact.id);
                                setContactOpen(false);
                                setContactSearch("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  contactId === contact.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {contact.full_name || contact.email || "Unnamed contact"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Fund</Label>
                <Input
                  placeholder="General Fund"
                  value={fundName}
                  onChange={(event) => setFundName(event.target.value)}
                />
              </div>
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
              <p className="text-xs text-muted-foreground">
                Memo is not saved yet because the shared donation_payments table does not currently have a memo column.
              </p>
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
                      {selectedPayment.payment_method || selectedPayment.source || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Donor:</span>{" "}
                    <span className="font-medium">{selectedPayment.donor_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fund:</span>{" "}
                    <span className="font-medium">{selectedPayment.fund_name || "—"}</span>
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
                          {pledge.fund_name || "No Fund"} — Balance:{" "}
                          {formatCurrency(
                            Number(pledge.amount || 0) -
                              Number(pledge.collected_amount || 0)
                          )}
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
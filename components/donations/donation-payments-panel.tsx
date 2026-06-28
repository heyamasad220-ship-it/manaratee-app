"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import {
  fetchOpenPledgesForAllocationAction,
  fetchPaymentsPageAction,
  searchContactsForDonationPickerAction,
} from "@/lib/donations/donation-list-actions";
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
import {
  fetchPledgeAttribution,
  toPaymentAttributionColumns,
} from "@/lib/donations/payment-attribution";
import { canAllocatePayment } from "@/lib/donations/payment-net-amount";
import { formatPaymentPledgeColumnLabel } from "@/lib/donations/donation-status";
import { getDonorProfilePath } from "@/lib/donations/donor-profile-path";

type Payment = {
  id: string;
  amount: number | string | null;
  payment_date: string | null;
  source: string | null;
  memo: string | null;
  pledge_id: string | null;
  donor_id: string | null;
  donor_type: string | null;
  status: string | null;
  sender_name: string | null;
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

function formatDate(date: string | null) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPaymentDonorName(payment: Payment) {
  return payment.sender_name || "—";
}

function canLinkPaymentToPledge(payment: Payment) {
  return canAllocatePayment({
    pledge_id: payment.pledge_id,
    status: payment.status,
    amount: Number(payment.amount || 0),
  });
}

export function DonationPaymentsPanel({ embedded = false }: { embedded?: boolean }) {
  const supabase = createClient();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

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

    const result = await fetchPaymentsPageAction({
      page: nextPage,
      pageSize: DONATIONS_PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: statusFilter,
    });

    if (!result.success) {
      setOrganizationId(null);
      setPayments([]);
      setTotalPayments(0);
      setContacts([]);
      setPledges([]);
      setLoading(false);
      return;
    }

    setPayments(result.payments as Payment[]);
    setTotalPayments(result.total);
    setPage(result.page);

    const orgId = organizationId;
    if (!orgId) {
      const orgFromProfile = await getOrgIdForCurrentUser();
      if (orgFromProfile) setOrganizationId(orgFromProfile);
    }

    const effectiveOrgId = organizationId || (await getOrgIdForCurrentUser());
    if (effectiveOrgId) {
      const pledgeResult = await fetchOpenPledgesForAllocationAction();

      if (pledgeResult.success) {
        setPledges(pledgeResult.pledges as PledgeOption[]);
      }
    }

    setLoading(false);
  }

  async function loadContactsForPicker(query: string) {
    const result = await searchContactsForDonationPickerAction(query, 50);
    if (result.success) {
      setContacts(result.contacts);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    void (async () => {
      const orgId = await getOrgIdForCurrentUser();
      if (orgId) {
        setOrganizationId(orgId);
        await loadContactsForPicker("");
      }
      await loadPayments(page);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    if (!showAddDialog) return;
    void loadContactsForPicker(donorSearch);
  }, [donorSearch, showAddDialog]);

  function resetForm() {
    setSelectedContactId(null);
    setDonorOpen(false);
    setDonorSearch("");
    setAmount("");
    setPaymentDate("");
    setSource("cash");
    setMemo("");
    setAttribution(EMPTY_DONATION_ATTRIBUTION_VALUE);
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

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search sender, memo, or method..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Pledge" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="unallocated">No</SelectItem>
              <SelectItem value="allocated">Yes</SelectItem>
              <SelectItem value="pending_review">Pending review</SelectItem>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="partially_refunded">Partially refunded</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {totalPayments > 0
              ? `${(page - 1) * DONATIONS_PAGE_SIZE + 1}–${Math.min(page * DONATIONS_PAGE_SIZE, totalPayments)} of ${totalPayments}`
              : "No payments"}
          </span>
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
                    <th className="text-left p-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="p-3">{formatDate(payment.payment_date)}</td>

                      <td className="p-3">
                        {payment.donor_id ? (
                          <Link
                            href={getDonorProfilePath(payment.donor_id, payment.donor_type)}
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

                      <td className="p-3 capitalize">
                        {payment.source || "—"}
                      </td>

                      <td className="p-3">{formatPaymentPledgeColumnLabel(payment.status)}</td>

                      <td className="p-3">
                        {canLinkPaymentToPledge(payment) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setSelectedPledgeId("");
                              setShowAllocateDialog(true);
                            }}
                          >
                            Link to pledge
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
            <DialogTitle>Record Payment</DialogTitle>
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
              onChange={setAttribution}
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
                    <span className="font-medium capitalize">
                      {selectedPayment.source || "—"}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Donor / Sender:</span>{" "}
                    {selectedPayment.donor_id ? (
                      <Link
                        href={getDonorProfilePath(
                          selectedPayment.donor_id,
                          selectedPayment.donor_type
                        )}
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

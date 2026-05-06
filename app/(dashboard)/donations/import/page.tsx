"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { getCurrentOrganizationId } from "@/lib/current-organization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type ImportMode = "donors" | "payments";

type ParsedDonorRow = {
  full_name: string;
  email: string;
  phone: string;
  donor_type: string;
};

type StagedDonorRow = {
  id: string;
  batch_id: string;
  normalized_full_name: string | null;
  normalized_email: string | null;
  normalized_phone: string | null;
  normalized_donor_type: string | null;
  import_status: string;
  error_message: string | null;
  created_at: string;
};

type ParsedPaymentRow = {
  sender_name: string;
  amount: string;
  payment_date: string;
  reference: string;
};

type StagedPaymentRow = {
  id: string;
  batch_id: string;
  sender_name: string | null;
  amount: number | null;
  payment_date: string | null;
  reference: string | null;
  import_status: string;
  created_at: string;
};

function normalizeText(value: string | undefined | null) {
  return (value || "").trim();
}

function normalizeEmail(value: string | undefined | null) {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value: string | undefined | null) {
  return normalizeText(value).replace(/[^\d]/g, "");
}

function normalizeDonorType(value: string | undefined | null) {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) return "";
  if (normalized === "individual") return "individual";
  if (normalized === "organization") return "organization";
  if (normalized === "business") return "organization";
  if (normalized === "company") return "organization";
  if (normalized === "household") return "household";

  return normalized;
}

function normalizeAmount(value: string | undefined | null) {
  const cleaned = normalizeText(value).replace(/[$,]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default function DonationsImportPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<ImportMode>("donors");
  
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [donorRows, setDonorRows] = useState<ParsedDonorRow[]>([]);
  const [stagedDonorRows, setStagedDonorRows] = useState<StagedDonorRow[]>([]);
  const [loadingStagedDonorRows, setLoadingStagedDonorRows] = useState(false);
  const [importingDonorRows, setImportingDonorRows] = useState(false);

  const [paymentRows, setPaymentRows] = useState<ParsedPaymentRow[]>([]);
  const [stagedPaymentRows, setStagedPaymentRows] = useState<StagedPaymentRow[]>([]);
  const [loadingStagedPaymentRows, setLoadingStagedPaymentRows] = useState(false);
  const [importingPaymentRows, setImportingPaymentRows] = useState(false);

  const validDonorRows = useMemo(() => {
    return donorRows.filter((row) => normalizeText(row.full_name) !== "");
  }, [donorRows]);

  const invalidDonorRows = useMemo(() => {
    return donorRows.filter((row) => normalizeText(row.full_name) === "");
  }, [donorRows]);

  const validPaymentRows = useMemo(() => {
    return paymentRows.filter((row) => {
      return normalizeText(row.sender_name) !== "" && normalizeAmount(row.amount) > 0;
    });
  }, [paymentRows]);

  const invalidPaymentRows = useMemo(() => {
    return paymentRows.filter((row) => {
      return normalizeText(row.sender_name) === "" || normalizeAmount(row.amount) <= 0;
    });
  }, [paymentRows]);

  function resetLoadedRows() {
    setFileName("");
    setDonorRows([]);
    setPaymentRows([]);
  }

  function handleFileChange(file: File | null) {
    if (!file) return;

    setLoading(true);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data as Record<string, string>[];

        if (mode === "donors") {
          const parsed = rawRows.map((row) => ({
            full_name: row.full_name || row.name || row.donor_name || "",
            email: row.email || "",
            phone: row.phone || row.mobile || "",
            donor_type: row.donor_type || row.type || "",
          }));

          setDonorRows(parsed);
          setPaymentRows([]);
        } else {
          const parsed = rawRows.map((row) => ({
            sender_name: row.sender_name || row["Sender Name"] || row.name || "",
            amount: row.amount || row.Amount || "",
            payment_date: row.payment_date || row["Payment Date"] || row.date || "",
            reference: row.reference || row.Reference || row.memo || "",
          }));

          setPaymentRows(parsed);
          setDonorRows([]);
        }

        setLoading(false);
      },
      error: (error) => {
        console.error(error);
        alert("Could not read CSV file");
        setLoading(false);
      },
    });
  }

  async function handleUploadDonorsToStaging() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      alert("No organization selected");
      return;
    }

    if (validDonorRows.length === 0) {
      alert("No valid donor rows to upload");
      return;
    }

    setSaving(true);

    const { data: batch, error: batchError } = await supabase
      .from("donor_import_batches")
      .insert({
        organization_id: orgId,
        file_name: fileName || "donor-import.csv",
        row_count: donorRows.length,
        status: "uploaded",
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      console.error(batchError);
      alert("Could not create donor import batch");
      setSaving(false);
      return;
    }

    const rowsToInsert = donorRows.map((row) => {
      const fullName = normalizeText(row.full_name);
      const email = normalizeEmail(row.email);
      const phone = normalizePhone(row.phone);
      const donorType = normalizeDonorType(row.donor_type);

      const hasError = !fullName;

      return {
        batch_id: batch.id,
        organization_id: orgId,
        raw_full_name: row.full_name || null,
        raw_email: row.email || null,
        raw_phone: row.phone || null,
        raw_donor_type: row.donor_type || null,
        normalized_full_name: fullName || null,
        normalized_email: email || null,
        normalized_phone: phone || null,
        normalized_donor_type: donorType || null,
        import_status: hasError ? "error" : "ready",
        error_message: hasError ? "Missing full name" : null,
      };
    });

    const { error: rowsError } = await supabase
      .from("donor_import_rows")
      .insert(rowsToInsert);

    setSaving(false);

    if (rowsError) {
      console.error(rowsError);
      alert("Could not save donor import rows");
      return;
    }

    alert("Donor import uploaded to staging successfully");
    resetLoadedRows();
    await loadStagedDonorRows();
  }

  async function handleUploadPaymentsToStaging() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      alert("No organization selected");
      return;
    }

    if (validPaymentRows.length === 0) {
      alert("No valid payment rows to upload");
      return;
    }

    setSaving(true);

    const { data: batch, error: batchError } = await supabase
      .from("payment_import_batches")
      .insert({
        organization_id: orgId,
        file_name: fileName || "payment-import.csv",
      })
      .select("id")
      .single();

    if (batchError || !batch) {
  console.error("payment_import_batches insert error:", batchError);
  alert(batchError?.message || "Could not create payment import batch");
  setSaving(false);
  return;
}

    const rowsToInsert = paymentRows.map((row) => {
      const senderName = normalizeText(row.sender_name);
      const amount = normalizeAmount(row.amount);
      const paymentDate = normalizeText(row.payment_date);
      const reference = normalizeText(row.reference);

      return {
        batch_id: batch.id,
        organization_id: orgId,
        sender_name: senderName || null,
        amount: amount > 0 ? amount : null,
        payment_date: paymentDate || null,
        reference: reference || null,
        raw_row: row,
        import_status: senderName && amount > 0 ? "pending" : "error",
      };
    });

    const { error: rowsError } = await supabase
      .from("payment_import_rows")
      .insert(rowsToInsert);

    setSaving(false);

    if (rowsError) {
      console.error(rowsError);
      alert("Could not save payment import rows");
      return;
    }

    alert("Payment import uploaded to staging successfully");
    resetLoadedRows();
    await loadStagedPaymentRows();
  }

  async function loadStagedDonorRows() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      setStagedDonorRows([]);
      return;
    }

    setLoadingStagedDonorRows(true);

    const { data, error } = await supabase
      .from("donor_import_rows")
      .select(`
        id,
        batch_id,
        normalized_full_name,
        normalized_email,
        normalized_phone,
        normalized_donor_type,
        import_status,
        error_message,
        created_at
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);

    setLoadingStagedDonorRows(false);

    if (error) {
      console.error(error);
      setStagedDonorRows([]);
      return;
    }

    setStagedDonorRows((data || []) as StagedDonorRow[]);
  }

  async function loadStagedPaymentRows() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      setStagedPaymentRows([]);
      return;
    }

    setLoadingStagedPaymentRows(true);

    const { data, error } = await supabase
      .from("payment_import_rows")
      .select(`
        id,
        batch_id,
        sender_name,
        amount,
        payment_date,
        reference,
        import_status,
        created_at
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);

    setLoadingStagedPaymentRows(false);

    if (error) {
      console.error(error);
      setStagedPaymentRows([]);
      return;
    }

    setStagedPaymentRows((data || []) as StagedPaymentRow[]);
  }

  async function handleImportReadyDonorRows() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      alert("No organization selected");
      return;
    }

    const readyRows = stagedDonorRows.filter((row) => row.import_status === "ready");

    if (readyRows.length === 0) {
      alert("No ready donor rows to import");
      return;
    }

    setImportingDonorRows(true);

    // Check for existing donors to avoid duplicates
    const { data: existingDonors, error: existingError } = await supabase
      .from("donors")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId);

    if (existingError) {
      console.error(existingError);
      alert(existingError.message || "Could not check existing donors");
      setImportingDonorRows(false);
      return;
    }

    function makeDonorKey(row: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }) {
      return [
        (row.full_name || "").trim().toLowerCase(),
        (row.email || "").trim().toLowerCase(),
        (row.phone || "").trim().toLowerCase(),
      ].join("|");
    }

    const existingKeys = new Set(
      (existingDonors || []).map((donor: any) =>
        makeDonorKey({
          full_name: donor.full_name,
          email: donor.email,
          phone: donor.phone,
        })
      )
    );

    const batchSeenKeys = new Set<string>();
    const rowsToInsert: typeof readyRows = [];
    const duplicateRows: typeof readyRows = [];

    for (const row of readyRows) {
      const key = makeDonorKey({
        full_name: row.normalized_full_name,
        email: row.normalized_email,
        phone: row.normalized_phone,
      });

      if (existingKeys.has(key) || batchSeenKeys.has(key)) {
        duplicateRows.push(row);
        continue;
      }

      batchSeenKeys.add(key);
      rowsToInsert.push(row);
    }

    if (rowsToInsert.length > 0) {
      const donorPayload = rowsToInsert.map((row) => ({
        organization_id: orgId,
        full_name: row.normalized_full_name,
        email: row.normalized_email || null,
        phone: row.normalized_phone || null,
        donor_type: row.normalized_donor_type || null,
      }));

      const { error: donorInsertError } = await supabase
        .from("donors")
        .insert(donorPayload);

      if (donorInsertError) {
        console.error(donorInsertError);
        alert("Could not import donors");
        setImportingDonorRows(false);
        return;
      }
    }

    const importedRowIds = rowsToInsert.map((row) => row.id);
    const duplicateRowIds = duplicateRows.map((row) => row.id);

    if (importedRowIds.length > 0) {
      const { error: importedUpdateError } = await supabase
        .from("donor_import_rows")
        .update({ import_status: "imported" })
        .in("id", importedRowIds);

      if (importedUpdateError) {
        console.error(importedUpdateError);
        alert("Donors were imported, but imported staging rows were not updated");
        setImportingDonorRows(false);
        return;
      }
    }

    if (duplicateRowIds.length > 0) {
      const { error: duplicateUpdateError } = await supabase
        .from("donor_import_rows")
        .update({
  import_status: "error",
  error_message: "Duplicate: matched existing donor by email or phone",
})
        .in("id", duplicateRowIds);

      if (duplicateUpdateError) {
        console.error(duplicateUpdateError);
        alert("Donors checked, but duplicate staging rows were not updated");
        setImportingDonorRows(false);
        return;
      }
    }

    setImportingDonorRows(false);
    await loadStagedDonorRows();

    alert(
      `Imported ${importedRowIds.length} donor(s). Skipped ${duplicateRowIds.length} duplicate(s).`
    );
  }

  async function handleImportReadyPaymentRows() {
  const orgId = await getCurrentOrganizationId();

  if (!orgId) {
    alert("No organization selected");
    return;
  }

  const readyRows = stagedPaymentRows.filter((row) => row.import_status === "pending");

  if (readyRows.length === 0) {
    alert("No pending payment rows to import");
    return;
  }

  setImportingPaymentRows(true);

  const { data: existingPayments, error: existingError } = await supabase
    .from("payments")
    .select("id, sender_name, amount, payment_date, memo")
    .eq("organization_id", orgId);

  if (existingError) {
    console.error(existingError);
    alert(existingError.message || "Could not check existing payments");
    setImportingPaymentRows(false);
    return;
  }

  function makeKey(row: {
    sender_name: string | null;
    amount: number | null;
    payment_date: string | null;
    memo?: string | null;
  }) {
    return [
      (row.sender_name || "").trim().toLowerCase(),
      Number(row.amount || 0).toFixed(2),
      row.payment_date || "",
      (row.memo || "").trim().toLowerCase(),
    ].join("|");
  }

  const existingKeys = new Set(
    (existingPayments || []).map((payment: any) =>
      makeKey({
        sender_name: payment.sender_name,
        amount: Number(payment.amount || 0),
        payment_date: payment.payment_date,
        memo: payment.memo,
      })
    )
  );

  const batchSeenKeys = new Set<string>();
  const rowsToInsert: typeof readyRows = [];
  const duplicateRows: typeof readyRows = [];

  for (const row of readyRows) {
    const key = makeKey({
      sender_name: row.sender_name,
      amount: Number(row.amount || 0),
      payment_date: row.payment_date,
      memo: row.reference,
    });

    if (existingKeys.has(key) || batchSeenKeys.has(key)) {
      duplicateRows.push(row);
      continue;
    }

    batchSeenKeys.add(key);
    rowsToInsert.push(row);
  }

  if (rowsToInsert.length > 0) {
    const paymentPayload = rowsToInsert.map((row) => ({
      organization_id: orgId,
      donor_id: null,
      pledge_id: null,
      sender_name: row.sender_name || null,
      amount: row.amount || 0,
      payment_date: row.payment_date || null,
      memo: row.reference || null,
      source: "import",
      status: "pending_review",
    }));

    const { error: paymentInsertError } = await supabase
      .from("payments")
      .insert(paymentPayload);

    if (paymentInsertError) {
      console.error("payments insert error:", paymentInsertError);
      alert(paymentInsertError.message || "Could not import payments");
      setImportingPaymentRows(false);
      return;
    }
  }

  const importedRowIds = rowsToInsert.map((row) => row.id);
  const duplicateRowIds = duplicateRows.map((row) => row.id);

  if (importedRowIds.length > 0) {
    const { error: importedUpdateError } = await supabase
      .from("payment_import_rows")
      .update({ import_status: "imported" })
      .in("id", importedRowIds);

    if (importedUpdateError) {
      console.error(importedUpdateError);
      alert("Payments imported, but imported staging rows were not updated");
      setImportingPaymentRows(false);
      return;
    }
  }

  if (duplicateRowIds.length > 0) {
    const { error: duplicateUpdateError } = await supabase
      .from("payment_import_rows")
      .update({ import_status: "duplicate" })
      .in("id", duplicateRowIds);

    if (duplicateUpdateError) {
      console.error(duplicateUpdateError);
      alert("Payments checked, but duplicate staging rows were not updated");
      setImportingPaymentRows(false);
      return;
    }
  }

  setImportingPaymentRows(false);
  await loadStagedPaymentRows();

  alert(
    `Imported ${importedRowIds.length} payment(s). Skipped ${duplicateRowIds.length} duplicate(s).`
  );
}

  useEffect(() => {
    loadStagedDonorRows();
    loadStagedPaymentRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    resetLoadedRows();
  }, [mode]);
async function handleClearDonorStaging() {
  const orgId = await getCurrentOrganizationId()

  if (!orgId) {
    alert("No organization selected")
    return
  }

  const confirmed = window.confirm(
    "Clear all staged donor rows? This will not delete real donors."
  )

  if (!confirmed) return

  const { error } = await supabase
    .from("donor_import_rows")
    .delete()
    .eq("organization_id", orgId)

  if (error) {
    console.error(error)
    alert("Could not clear donor staging rows")
    return
  }

  await loadStagedDonorRows()
  alert("Donor staging rows cleared")
}
  return (
    <>
      <Header title="Donations Import" />

      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Type</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              variant={mode === "donors" ? "default" : "outline"}
              onClick={() => setMode("donors")}
            >
              Donors
            </Button>
            <Button
              variant={mode === "payments" ? "default" : "outline"}
              onClick={() => setMode("payments")}
            >
              Payments
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "donors" ? "Upload Donor CSV" : "Upload Payment CSV"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-csv">CSV File</Label>
              <Input
                id="import-csv"
                type="file"
                accept=".csv"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </div>

            <div className="text-sm text-muted-foreground">
              {mode === "donors" ? (
                <>
                  Expected columns: <strong>full_name</strong>, <strong>email</strong>,{" "}
                  <strong>phone</strong>, <strong>donor_type</strong>
                </>
              ) : (
                <>
                  Expected columns: <strong>sender_name</strong>, <strong>amount</strong>,{" "}
                  <strong>payment_date</strong>, <strong>reference</strong>
                </>
              )}
            </div>

            <div className="flex gap-3">
              {mode === "donors" ? (
                <Button
                  onClick={handleUploadDonorsToStaging}
                  disabled={saving || validDonorRows.length === 0}
                >
                  {saving ? "Uploading..." : "Upload Donors to Staging"}
                </Button>
              ) : (
                <Button
                  onClick={handleUploadPaymentsToStaging}
                  disabled={saving || validPaymentRows.length === 0}
                >
                  {saving ? "Uploading..." : "Upload Payments to Staging"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Reading file...</div>
            ) : mode === "donors" ? (
              donorRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No donor rows loaded yet.</div>
              ) : (
                <>
                  <div className="text-sm">
                    Total Rows: <strong>{donorRows.length}</strong> | Valid:{" "}
                    <strong>{validDonorRows.length}</strong> | Invalid:{" "}
                    <strong>{invalidDonorRows.length}</strong>
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="p-3 text-left">Full Name</th>
                          <th className="p-3 text-left">Email</th>
                          <th className="p-3 text-left">Phone</th>
                          <th className="p-3 text-left">Donor Type</th>
                          <th className="p-3 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {donorRows.slice(0, 25).map((row, index) => {
                          const isValid = normalizeText(row.full_name) !== "";

                          return (
                            <tr key={index} className="border-b">
                              <td className="p-3">{row.full_name || "—"}</td>
                              <td className="p-3">{row.email || "—"}</td>
                              <td className="p-3">{row.phone || "—"}</td>
                              <td className="p-3">{row.donor_type || "—"}</td>
                              <td className="p-3">
                                {isValid ? "Ready" : "Missing full name"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {donorRows.length > 25 && (
                    <div className="text-xs text-muted-foreground">
                      Showing first 25 rows only.
                    </div>
                  )}
                </>
              )
            ) : paymentRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No payment rows loaded yet.</div>
            ) : (
              <>
                <div className="text-sm">
                  Total Rows: <strong>{paymentRows.length}</strong> | Valid:{" "}
                  <strong>{validPaymentRows.length}</strong> | Invalid:{" "}
                  <strong>{invalidPaymentRows.length}</strong>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="p-3 text-left">Sender Name</th>
                        <th className="p-3 text-left">Amount</th>
                        <th className="p-3 text-left">Payment Date</th>
                        <th className="p-3 text-left">Reference</th>
                        <th className="p-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRows.slice(0, 25).map((row, index) => {
                        const isValid =
                          normalizeText(row.sender_name) !== "" &&
                          normalizeAmount(row.amount) > 0;

                        return (
                          <tr key={index} className="border-b">
                            <td className="p-3">{row.sender_name || "—"}</td>
                            <td className="p-3">{row.amount || "—"}</td>
                            <td className="p-3">{row.payment_date || "—"}</td>
                            <td className="p-3">{row.reference || "—"}</td>
                            <td className="p-3">
                              {isValid ? "Ready" : "Missing sender name or amount"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {paymentRows.length > 25 && (
                  <div className="text-xs text-muted-foreground">
                    Showing first 25 rows only.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {mode === "donors" ? (
          <Card>
            <CardHeader>
              <CardTitle>Staged Donor Rows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={handleImportReadyDonorRows}
                  disabled={
                    importingDonorRows ||
                    stagedDonorRows.filter((row) => row.import_status === "ready").length === 0
                  }
                >
                  {importingDonorRows ? "Importing..." : "Import Ready Donor Rows"}
                </Button>
                <Button
  variant="outline"
  onClick={handleClearDonorStaging}
  disabled={stagedDonorRows.length === 0}
>
  Clear Staging Rows
</Button>
              </div>

              {loadingStagedDonorRows ? (
                <div className="text-sm text-muted-foreground">Loading staged donor rows...</div>
              ) : stagedDonorRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No staged donor rows yet.</div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="p-3 text-left">Full Name</th>
                        <th className="p-3 text-left">Email</th>
                        <th className="p-3 text-left">Phone</th>
                        <th className="p-3 text-left">Donor Type</th>
                        <th className="p-3 text-left">Import Status</th>
                        <th className="p-3 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stagedDonorRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-3">{row.normalized_full_name || "—"}</td>
                          <td className="p-3">{row.normalized_email || "—"}</td>
                          <td className="p-3">{row.normalized_phone || "—"}</td>
                          <td className="p-3">{row.normalized_donor_type || "—"}</td>
                          <td className="p-3">{row.import_status}</td>
                          <td className="p-3">{row.error_message || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Staged Payment Rows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={handleImportReadyPaymentRows}
                  disabled={
                    importingPaymentRows ||
                    stagedPaymentRows.filter((row) => row.import_status === "pending").length === 0
                  }
                >
                  {importingPaymentRows ? "Importing..." : "Import Ready Payment Rows"}
                </Button>
              </div>

              {loadingStagedPaymentRows ? (
                <div className="text-sm text-muted-foreground">Loading staged payment rows...</div>
              ) : stagedPaymentRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No staged payment rows yet.</div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="p-3 text-left">Sender Name</th>
                        <th className="p-3 text-left">Amount</th>
                        <th className="p-3 text-left">Payment Date</th>
                        <th className="p-3 text-left">Reference</th>
                        <th className="p-3 text-left">Import Status</th>
                        <th className="p-3 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stagedPaymentRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-3">{row.sender_name || "—"}</td>
                          <td className="p-3">
                            {row.amount !== null ? `$${Number(row.amount).toLocaleString()}` : "—"}
                          </td>
                          <td className="p-3">{formatDate(row.payment_date)}</td>
                          <td className="p-3">{row.reference || "—"}</td>
                          <td className="p-3">{row.import_status}</td>
                          <td className="p-3">{formatDate(row.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
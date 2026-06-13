"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { getCurrentOrganizationId } from "@/lib/current-organization";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields";
import {
  buildAttributionLookupMaps,
  mergePaymentAttribution,
  parseImportAttributionFromRawRow,
  resolveAttributionFromNames,
  toPaymentAttributionColumns,
} from "@/lib/donations/payment-attribution";

type ParsedPaymentRow = {
  sender_name: string;
  amount: string;
  payment_date: string;
  reference: string;
  campaign?: string;
  category?: string;
  fund?: string;
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
  raw_row?: Record<string, unknown> | null;
};

type ImportBatch = {
  id: string;
  file_name: string | null;
  row_count: number | null;
  status: string | null;
  created_at: string;
};

function normalizeText(value: string | undefined | null) {
  return (value || "").trim();
}

function normalizeAmount(value: string | undefined | null) {
  const cleaned = normalizeText(value).replace(/[$,]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: string | undefined | null) {
  const text = normalizeText(value);
  if (!text) return "";

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  return parsed.toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function getRowProblem(row: StagedPaymentRow) {
  if (row.import_status !== "error") return "—";

  const problems: string[] = [];

  if (!normalizeText(row.sender_name)) problems.push("Missing sender name");
  if (!row.amount || Number(row.amount) <= 0)
    problems.push("Missing or invalid amount");
  if (!row.payment_date) problems.push("Missing payment date");

  return problems.length > 0 ? problems.join("; ") : "Invalid row";
}

function makePaymentKey(row: {
  sender_name: string | null;
  amount: number | null;
  payment_date: string | null;
  memo?: string | null;
}) {
  return [
    (row.sender_name || "").trim().toLowerCase(),
    Number(row.amount || 0).toFixed(2),
    (row.payment_date || "").slice(0, 10),
    (row.memo || "").trim().toLowerCase(),
  ].join("|");
}

export default function DonationsImportPage() {
  const supabase = createClient();

  const [fileName, setFileName] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importingPaymentRows, setImportingPaymentRows] = useState(false);
  const [loadingStagedPaymentRows, setLoadingStagedPaymentRows] =
    useState(false);
  const [loadingImportHistory, setLoadingImportHistory] = useState(false);

  const [paymentRows, setPaymentRows] = useState<ParsedPaymentRow[]>([]);
  const [stagedPaymentRows, setStagedPaymentRows] = useState<
    StagedPaymentRow[]
  >([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [defaultAttribution, setDefaultAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  );

  const validPaymentRows = useMemo(() => {
    return paymentRows.filter((row) => {
      return (
        normalizeText(row.sender_name) !== "" && normalizeAmount(row.amount) > 0
      );
    });
  }, [paymentRows]);

  const invalidPaymentRows = useMemo(() => {
    return paymentRows.filter((row) => {
      return (
        normalizeText(row.sender_name) === "" ||
        normalizeAmount(row.amount) <= 0
      );
    });
  }, [paymentRows]);

  const pendingRows = stagedPaymentRows.filter(
    (row) => row.import_status === "pending",
  );
  const errorRows = stagedPaymentRows.filter(
    (row) => row.import_status === "error",
  );
  const duplicateRows = stagedPaymentRows.filter(
    (row) => row.import_status === "duplicate",
  );
  const importedRows = stagedPaymentRows.filter(
    (row) => row.import_status === "imported",
  );

  const allRowsSelected =
    stagedPaymentRows.length > 0 &&
    selectedRowIds.length === stagedPaymentRows.length;

  function resetLoadedRows() {
    setFileName("");
    setPaymentRows([]);
  }

  function toggleSelectedRow(rowId: string) {
    setSelectedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  }

  function toggleSelectAllRows() {
    if (allRowsSelected) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(stagedPaymentRows.map((row) => row.id));
    }
  }

  function handleFileChange(file: File | null) {
    if (!file) return;

    setLoadingFile(true);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data as Record<string, string>[];

        const parsed = rawRows.map((row) => ({
          sender_name:
            row.sender_name ||
            row["Sender Name"] ||
            row.sender ||
            row.name ||
            row.Name ||
            "",
          amount:
            row.amount ||
            row.Amount ||
            row.payment_amount ||
            row["Payment Amount"] ||
            "",
          payment_date:
            row.payment_date ||
            row["Payment Date"] ||
            row.date ||
            row.Date ||
            "",
          reference:
            row.reference ||
            row.Reference ||
            row.memo ||
            row.Memo ||
            row.description ||
            row.Description ||
            "",
          campaign:
            row.campaign ||
            row.Campaign ||
            row.campaign_name ||
            row["Campaign Name"] ||
            "",
          category:
            row.category ||
            row.Category ||
            row.category_name ||
            row["Category Name"] ||
            "",
          fund:
            row.fund ||
            row.Fund ||
            row.subcategory ||
            row.Subcategory ||
            row.fund_name ||
            row["Fund Name"] ||
            "",
        }));

        setPaymentRows(parsed);
        setLoadingFile(false);
      },
      error: (error) => {
        console.error(error);
        alert("Could not read CSV file");
        setLoadingFile(false);
      },
    });
  }

  async function deleteStagingRowsByIds(rowIds: string[]) {
    if (rowIds.length === 0) return true;

    const { data, error } = await supabase
      .from("payment_import_rows")
      .delete()
      .in("id", rowIds)
      .select("id");

    if (error) {
      console.error(error);
      alert(error.message || "Could not clear selected staging rows");
      return false;
    }

    if ((data || []).length === 0) {
      alert(
        "No staging rows were deleted. This usually means RLS blocked the delete or the selected row IDs did not match.",
      );
      await loadStagedPaymentRows();
      return false;
    }

    setSelectedRowIds((current) =>
      current.filter((id) => !rowIds.includes(id)),
    );
    await loadStagedPaymentRows();
    await loadImportHistory();
    return true;
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
        row_count: paymentRows.length,
        status: "uploaded",
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
      const paymentDate = normalizeDate(row.payment_date);
      const reference = normalizeText(row.reference);

      const hasError = !senderName || amount <= 0;

      return {
        batch_id: batch.id,
        organization_id: orgId,
        sender_name: senderName || null,
        amount: amount > 0 ? amount : null,
        payment_date: paymentDate || null,
        reference: reference || null,
        raw_row: row,
        import_status: hasError ? "error" : "pending",
      };
    });

    const { error: rowsError } = await supabase
      .from("payment_import_rows")
      .insert(rowsToInsert);

    setSaving(false);

    if (rowsError) {
      console.error(rowsError);
      alert(rowsError.message || "Could not save payment import rows");
      return;
    }

    alert("Payment import uploaded to staging");
    resetLoadedRows();
    await loadStagedPaymentRows();
    await loadImportHistory();
  }

  async function loadStagedPaymentRows() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      setStagedPaymentRows([]);
      setSelectedRowIds([]);
      setOrganizationId(null);
      return;
    }

    setOrganizationId(orgId);

    setLoadingStagedPaymentRows(true);

    const { data, error } = await supabase
      .from("payment_import_rows")
      .select(
        `
        id,
        batch_id,
        sender_name,
        amount,
        payment_date,
        reference,
        import_status,
        created_at,
        raw_row
      `,
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500);

    setLoadingStagedPaymentRows(false);

    if (error) {
      console.error(error);
      setStagedPaymentRows([]);
      setSelectedRowIds([]);
      return;
    }

    const rows = (data || []) as StagedPaymentRow[];
    setStagedPaymentRows(rows);
    setSelectedRowIds((current) =>
      current.filter((id) => rows.some((row) => row.id === id)),
    );
  }

  async function loadImportHistory() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      setImportBatches([]);
      return;
    }

    setLoadingImportHistory(true);

    const { data, error } = await supabase
      .from("payment_import_batches")
      .select(
        `
        id,
        file_name,
        row_count,
        status,
        created_at
      `,
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);

    setLoadingImportHistory(false);

    if (error) {
      console.error("Import history error:", error);
alert(error.message || JSON.stringify(error));
      return;
    }

    setImportBatches((data || []) as ImportBatch[]);
  }

  async function handleImportReadyPaymentRows() {
    const orgId = await getCurrentOrganizationId();

    if (!orgId) {
      alert("No organization selected");
      return;
    }

    const readyRows = stagedPaymentRows.filter(
      (row) => row.import_status === "pending",
    );

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

    const existingKeys = new Set(
      (existingPayments || []).map((payment: any) =>
        makePaymentKey({
          sender_name: payment.sender_name,
          amount: Number(payment.amount || 0),
          payment_date: payment.payment_date,
          memo: payment.memo,
        }),
      ),
    );

    const batchSeenKeys = new Set<string>();
    const rowsToInsert: typeof readyRows = [];
    const duplicateRowsToMark: typeof readyRows = [];

    for (const row of readyRows) {
      const key = makePaymentKey({
        sender_name: row.sender_name,
        amount: Number(row.amount || 0),
        payment_date: row.payment_date,
        memo: row.reference,
      });

      if (existingKeys.has(key) || batchSeenKeys.has(key)) {
        duplicateRowsToMark.push(row);
        continue;
      }

      batchSeenKeys.add(key);
      rowsToInsert.push(row);
    }

    if (rowsToInsert.length > 0) {
      const lookupMaps = await buildAttributionLookupMaps(supabase, orgId);
      const fallbackAttribution = toAttributionIds(defaultAttribution);

      const paymentPayload = rowsToInsert.map((row) => {
        const fromRow = resolveAttributionFromNames(
          parseImportAttributionFromRawRow(row.raw_row),
          lookupMaps
        );
        const attribution = mergePaymentAttribution(fromRow, fallbackAttribution);

        return {
          organization_id: orgId,
          donor_id: null,
          contact_id: null,
          pledge_id: null,
          sender_name: row.sender_name || null,
          amount: row.amount || 0,
          payment_date: row.payment_date
            ? `${String(row.payment_date).slice(0, 10)}T12:00:00`
            : new Date().toISOString(),
          memo: row.reference || null,
          source: "import",
          source_type: "import",
          status: "pending_review",
          is_verified: false,
          ...toPaymentAttributionColumns(attribution),
        };
      });

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
    const duplicateRowIds = duplicateRowsToMark.map((row) => row.id);

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
    await loadImportHistory();

    alert(
      `Imported ${importedRowIds.length} payment(s). Marked ${duplicateRowIds.length} duplicate(s). You can now clear imported or duplicate rows.`,
    );
  }

  async function handleClearSelectedRows() {
    if (selectedRowIds.length === 0) {
      alert("Select at least one row to clear");
      return;
    }

    const confirmed = window.confirm(
      `Clear ${selectedRowIds.length} selected staged row(s)? This will not delete real payments.`,
    );

    if (!confirmed) return;

    await deleteStagingRowsByIds(selectedRowIds);
  }

  async function handleClearImportedRows() {
    const ids = stagedPaymentRows
      .filter((row) => row.import_status === "imported")
      .map((row) => row.id);

    if (ids.length === 0) {
      alert("No imported rows to clear");
      return;
    }

    const confirmed = window.confirm(
      `Clear ${ids.length} imported staged row(s)? This will not delete real payments.`,
    );

    if (!confirmed) return;

    await deleteStagingRowsByIds(ids);
  }

  async function handleClearDuplicateRows() {
    const ids = stagedPaymentRows
      .filter((row) => row.import_status === "duplicate")
      .map((row) => row.id);

    if (ids.length === 0) {
      alert("No duplicate rows to clear");
      return;
    }

    const confirmed = window.confirm(
      `Clear ${ids.length} duplicate staged row(s)? This will not delete real payments.`,
    );

    if (!confirmed) return;

    await deleteStagingRowsByIds(ids);
  }

  async function handleClearErrorRows() {
    const ids = stagedPaymentRows
      .filter((row) => row.import_status === "error")
      .map((row) => row.id);

    if (ids.length === 0) {
      alert("No error rows to clear");
      return;
    }

    const confirmed = window.confirm(
      `Ignore and clear ${ids.length} error row(s)? These rows will not be imported.`,
    );

    if (!confirmed) return;

    await deleteStagingRowsByIds(ids);
  }

  async function handleClearAllStagingRows() {
    if (stagedPaymentRows.length === 0) {
      alert("No staged rows to clear");
      return;
    }

    const confirmed = window.confirm(
      "Clear all staged payment rows? This will not delete real payments.",
    );

    if (!confirmed) return;

    await deleteStagingRowsByIds(stagedPaymentRows.map((row) => row.id));
  }

  useEffect(() => {
    loadStagedPaymentRows();
    loadImportHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header title="Payment Import" />

      <Tabs defaultValue="import" className="p-6">
        <TabsList className="mb-6">
          <TabsTrigger value="import">Import Queue</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Payment CSV</CardTitle>
                <CardDescription>
                  Import payments into staging first, then move valid rows into
                  the payments ledger.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="import-csv">CSV File</Label>
                  <Input
                    id="import-csv"
                    type="file"
                    accept=".csv"
                    onChange={(e) =>
                      handleFileChange(e.target.files?.[0] || null)
                    }
                  />
                </div>

                <div className="text-sm text-muted-foreground">
                  Expected columns: <strong>sender_name</strong>,{" "}
                  <strong>amount</strong>, <strong>payment_date</strong>,{" "}
                  <strong>reference</strong>
                </div>

                <Button
                  onClick={handleUploadPaymentsToStaging}
                  disabled={saving || validPaymentRows.length === 0}
                >
                  {saving ? "Uploading..." : "Upload Payments to Staging"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {loadingFile ? (
                  <div className="text-sm text-muted-foreground">
                    Reading file...
                  </div>
                ) : paymentRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No payment rows loaded yet.
                  </div>
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
                                <td className="p-3">
                                  {row.sender_name || "—"}
                                </td>
                                <td className="p-3">{row.amount || "—"}</td>
                                <td className="p-3">
                                  {row.payment_date || "—"}
                                </td>
                                <td className="p-3">{row.reference || "—"}</td>
                                <td className="p-3">
                                  {isValid
                                    ? "Ready"
                                    : "Missing sender name or amount"}
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

            <Card>
              <CardHeader>
                <CardTitle>Staged Payment Rows</CardTitle>
                <CardDescription>
                  Import pending rows, review errors, and clear rows after
                  import.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-muted-foreground">Pending</div>
                    <div className="text-xl font-semibold">
                      {pendingRows.length}
                    </div>
                  </div>

                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-muted-foreground">Errors</div>
                    <div className="text-xl font-semibold">
                      {errorRows.length}
                    </div>
                  </div>

                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-muted-foreground">Duplicates</div>
                    <div className="text-xl font-semibold">
                      {duplicateRows.length}
                    </div>
                  </div>

                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-muted-foreground">Imported</div>
                    <div className="text-xl font-semibold">
                      {importedRows.length}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Default attribution</p>
                    <p className="text-xs text-muted-foreground">
                      Applied when CSV rows omit campaign, category, or fund columns.
                      Optional columns: campaign, category, fund (or Campaign Name, Category Name, Fund Name).
                    </p>
                  </div>
                  <DonationAttributionFields
                    organizationId={organizationId}
                    value={defaultAttribution}
                    onChange={setDefaultAttribution}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleImportReadyPaymentRows}
                    disabled={importingPaymentRows || pendingRows.length === 0}
                  >
                    {importingPaymentRows
                      ? "Importing..."
                      : "Import Pending Payments"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleClearSelectedRows}
                    disabled={selectedRowIds.length === 0}
                  >
                    Clear Selected
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleClearImportedRows}
                    disabled={importedRows.length === 0}
                  >
                    Clear Imported
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleClearDuplicateRows}
                    disabled={duplicateRows.length === 0}
                  >
                    Clear Duplicates
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleClearErrorRows}
                    disabled={errorRows.length === 0}
                  >
                    Ignore / Clear Errors
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleClearAllStagingRows}
                    disabled={stagedPaymentRows.length === 0}
                  >
                    Clear All Staging
                  </Button>
                </div>

                {loadingStagedPaymentRows ? (
                  <div className="text-sm text-muted-foreground">
                    Loading staged payment rows...
                  </div>
                ) : stagedPaymentRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No staged payment rows.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="w-[48px] p-3 text-left">
                            <Checkbox
                              checked={allRowsSelected}
                              onCheckedChange={toggleSelectAllRows}
                            />
                          </th>
                          <th className="p-3 text-left">Sender Name</th>
                          <th className="p-3 text-left">Amount</th>
                          <th className="p-3 text-left">Payment Date</th>
                          <th className="p-3 text-left">Reference</th>
                          <th className="p-3 text-left">Import Status</th>
                          <th className="p-3 text-left">Problem</th>
                          <th className="p-3 text-left">Created</th>
                        </tr>
                      </thead>

                      <tbody>
                        {stagedPaymentRows.map((row) => (
                          <tr key={row.id} className="border-b">
                            <td className="p-3">
                              <Checkbox
                                checked={selectedRowIds.includes(row.id)}
                                onCheckedChange={() =>
                                  toggleSelectedRow(row.id)
                                }
                              />
                            </td>
                            <td className="p-3">{row.sender_name || "—"}</td>
                            <td className="p-3">
                              {row.amount !== null
                                ? `$${Number(row.amount).toLocaleString()}`
                                : "—"}
                            </td>
                            <td className="p-3">
                              {formatDate(row.payment_date)}
                            </td>
                            <td className="p-3">{row.reference || "—"}</td>
                            <td className="p-3">{row.import_status}</td>
                            <td className="p-3 text-muted-foreground">
                              {getRowProblem(row)}
                            </td>
                            <td className="p-3">
                              {formatDate(row.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                Previously uploaded payment import batches.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={loadImportHistory}
                  disabled={loadingImportHistory}
                >
                  {loadingImportHistory ? "Refreshing..." : "Refresh History"}
                </Button>
              </div>

              {loadingImportHistory ? (
                <div className="text-sm text-muted-foreground">
                  Loading import history...
                </div>
              ) : importBatches.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No import batches found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="p-3 text-left">File Name</th>
                        <th className="p-3 text-left">Rows</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Created</th>
                      </tr>
                    </thead>

                    <tbody>
                      {importBatches.map((batch) => (
                        <tr key={batch.id} className="border-b">
                          <td className="p-3">{batch.file_name || "—"}</td>
                          <td className="p-3">{batch.row_count ?? 0}</td>
                          <td className="p-3">{batch.status || "—"}</td>
                          <td className="p-3">
                            {formatDate(batch.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

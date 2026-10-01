import { format } from "date-fns";
import type { TransactionWithRelations } from "@/hooks/useTransactions";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function transactionsToCSV(rows: TransactionWithRelations[]): string {
  const header = [
    "date_utc",
    "type",
    "amount_inr",
    "category",
    "group",
    "note",
    "counterparty",
    "direction",
    "settled",
    "source",
  ];
  const lines = [header.join(",")];
  for (const t of rows) {
    lines.push(
      [
        new Date(t.occurred_at).toISOString(),
        t.type,
        Number(t.amount).toFixed(2),
        t.category?.name ?? "",
        t.group?.name ?? "",
        t.note ?? "",
        t.lending_details?.counterparty ?? "",
        t.lending_details?.direction ?? "",
        t.lending_details ? String(t.lending_details.settled) : "",
        t.source,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadText(
  filename: string,
  content: string,
  mime = "text/plain",
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportCSV(rows: TransactionWithRelations[]) {
  const csv = transactionsToCSV(rows);
  downloadText(
    `spendwise-${format(new Date(), "yyyy-MM-dd")}.csv`,
    csv,
    "text/csv;charset=utf-8",
  );
}

export async function exportPDF(rows: TransactionWithRelations[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("SpendWise — Transactions", 14, 16);
  doc.setFontSize(10);
  doc.text(
    `Exported ${format(new Date(), "PPP")} · ${rows.length} rows`,
    14,
    22,
  );
  autoTable(doc, {
    startY: 28,
    head: [["Date (UTC)", "Type", "Category", "Group", "Amount (INR)", "Note"]],
    body: rows.map((t) => [
      new Date(t.occurred_at).toISOString(),
      t.type,
      t.category?.name ?? "",
      t.group?.name ?? "",
      Number(t.amount).toFixed(2),
      t.note ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [36, 100, 77] },
  });
  doc.save(`spendwise-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

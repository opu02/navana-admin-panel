// Export the rows of the CURRENT page: Print, Excel, PDF, CSV
import type { Prescription } from "./types";
import { formatDate, formatDateTime, toInputDate } from "./format";

const HEADERS = ["SL", "Doctor Name", "NPL", "Patient Name", "Appointment Date", "Uploaded On", "Brand Info"];
const TITLE = "Prescription Report — Navana Pharmaceuticals PLC";

const brandText = (p: Prescription, sep: string) =>
  p.brands.map((b) => (b.isNavana ? `${b.name} (Navana)` : b.name)).join(sep);

function toRows(items: Prescription[], startIndex: number, brandSep: string) {
  return items.map((p, i) => [
    String(startIndex + i + 1),
    p.doctorName,
    p.npl,
    p.patientName,
    formatDate(p.appointmentDate),
    formatDateTime(p.uploadedAt),
    brandText(p, brandSep),
  ]);
}

function fileName(page: number, ext: string) {
  return `prescription-report-page-${page}-${toInputDate(new Date())}.${ext}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =============== Generic exporters (used by every report) ===============
export type TableExport = {
  title: string;
  fileBase: string; // e.g. "doctor-report"
  headers: string[];
  rows: string[][]; // use "\n" for line breaks inside a cell
  page: number;
  widths?: number[]; // Excel column widths
};

const fname = (t: TableExport, ext: string) => `${t.fileBase}-page-${t.page}-${toInputDate(new Date())}.${ext}`;

export function csvOf(t: TableExport) {
  const esc = (v: string) => `"${v.replace(/\n/g, "; ").replace(/"/g, '""')}"`;
  const lines = [t.headers, ...t.rows].map((r) => r.map(esc).join(","));
  download(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), fname(t, "csv"));
}

export async function excelOf(t: TableExport) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");
  ws.columns = t.headers.map((_, i) => ({ width: t.widths?.[i] ?? 22 }));
  ws.addRow(t.headers);
  t.rows.forEach((r) => ws.addRow(r));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  ws.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fname(t, "xlsx"));
}

export async function pdfOf(t: TableExport) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(t.title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Page ${t.page} · Generated ${formatDateTime(new Date().toISOString())}`, 40, 58);
  autoTable(doc, {
    startY: 72, head: [t.headers], body: t.rows,
    styles: { fontSize: 8, cellPadding: 4, valign: "top" },
    headStyles: { fillColor: [30, 58, 138], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(fname(t, "pdf"));
}

export function printOf(t: TableExport) {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.title)}</title>
<style>
  body{font-family:Arial,sans-serif;margin:24px;color:#111}
  h1{font-size:16px;margin:0 0 4px} p{font-size:11px;color:#666;margin:0 0 14px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#1e3a8a;color:#fff;text-align:left;padding:6px}
  td{border-bottom:1px solid #ddd;padding:6px;vertical-align:top}
  tr:nth-child(even) td{background:#f5f7fa}
  @page{size:A4 landscape;margin:12mm}
  th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<h1>${esc(t.title)}</h1><p>Page ${t.page} · Printed ${esc(formatDateTime(new Date().toISOString()))}</p>
<table><thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
  return true;
}

// =============== Prescription report ===============
// ---------- CSV ----------
export function exportCsv(items: Prescription[], page: number, startIndex: number) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [HEADERS, ...toRows(items, startIndex, "; ")].map((r) => r.map(esc).join(","));
  // BOM so Excel opens UTF-8 correctly
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), fileName(page, "csv"));
}

// ---------- Excel ----------
export async function exportExcel(items: Prescription[], page: number, startIndex: number) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Prescriptions");

  ws.columns = [
    { width: 6 }, { width: 28 }, { width: 14 }, { width: 20 }, { width: 16 }, { width: 22 }, { width: 50 },
  ];
  ws.addRow(HEADERS);
  toRows(items, startIndex, "\n").forEach((r) => ws.addRow(r));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  ws.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileName(page, "xlsx")
  );
}

// ---------- PDF ----------
export async function exportPdf(items: Prescription[], page: number, startIndex: number) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(TITLE, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Page ${page} · Generated ${formatDateTime(new Date().toISOString())}`, 40, 58);

  autoTable(doc, {
    startY: 72,
    head: [HEADERS],
    body: toRows(items, startIndex, "\n"),
    styles: { fontSize: 8, cellPadding: 4, valign: "top" },
    headStyles: { fillColor: [30, 58, 138], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 28 }, 6: { cellWidth: 220 } },
  });

  doc.save(fileName(page, "pdf"));
}

// ---------- Print ----------
export function printTable(items: Prescription[], page: number, startIndex: number) {
  const esc = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const body = toRows(items, startIndex, "\n")
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`)
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${TITLE}</title>
<style>
  body{font-family:Arial,sans-serif;margin:24px;color:#111}
  h1{font-size:16px;margin:0 0 4px} p{font-size:11px;color:#666;margin:0 0 14px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#1e3a8a;color:#fff;text-align:left;padding:6px}
  td{border-bottom:1px solid #ddd;padding:6px;vertical-align:top}
  tr:nth-child(even) td{background:#f5f7fa}
  @page{size:A4 landscape;margin:12mm}
  th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<h1>${TITLE}</h1><p>Page ${page} · Printed ${esc(formatDateTime(new Date().toISOString()))}</p>
<table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;

  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return false; // popup blocked
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 300);
  return true;
}

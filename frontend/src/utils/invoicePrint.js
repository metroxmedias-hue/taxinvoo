import { formatCurrency } from './invoiceCalculations.js';
import {
  getInvoiceHeading,
  getInvoiceMetaRows,
  getInvoiceNotes,
  getInvoiceSummaryRows,
  getInvoiceTableRows
} from './invoiceTemplate.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildInvoicePrintHtml(invoice) {
  const metaRows = getInvoiceMetaRows(invoice)
    .map(
      (row) => `
        <div class="meta-row">
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}</strong>
        </div>
      `
    )
    .join('');

  const tableRows = getInvoiceTableRows(invoice)
    .map(
      (row) => `
        <tr>
          <td>${row.index}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(row.itemType)}</td>
          <td class="num">${escapeHtml(row.quantity)}</td>
          <td class="num">${escapeHtml(row.rate)}</td>
          <td class="num">${escapeHtml(row.lineTotal)}</td>
        </tr>
      `
    )
    .join('');

  const summaryRows = getInvoiceSummaryRows(invoice)
    .map(
      (row) => `
        <div class="summary-row ${row.emphasis ? 'emphasis' : ''}">
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}</strong>
        </div>
      `
    )
    .join('');

  const notes = getInvoiceNotes(invoice)
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join('');

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(invoice.invoiceNumber || 'invoice')}</title>
        <style>
          :root {
            color-scheme: light;
            --ink: #183153;
            --muted: #5b6f8f;
            --line: #d7e2f0;
            --surface: #f7fbff;
            --brand: #1e88e5;
            --accent: #0ea5a4;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Poppins", "Segoe UI", sans-serif;
            color: var(--ink);
            background: #eef5fb;
          }
          .sheet {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 18mm 16mm;
            background: white;
          }
          .topbar {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            align-items: start;
            margin-bottom: 20px;
          }
          .eyebrow {
            display: inline-block;
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(30, 136, 229, 0.12);
            color: var(--brand);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          h1 {
            margin: 10px 0 0;
            font-size: 28px;
          }
          .meta {
            min-width: 280px;
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 14px;
            background: var(--surface);
          }
          .meta-row,
          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 8px 0;
            border-bottom: 1px solid var(--line);
          }
          .meta-row:last-child,
          .summary-row:last-child {
            border-bottom: 0;
          }
          .meta-row span,
          .summary-row span {
            color: var(--muted);
          }
          .table-wrap,
          .summary {
            border: 1px solid var(--line);
            border-radius: 16px;
            background: var(--surface);
            overflow: hidden;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 12px;
            border-bottom: 1px solid var(--line);
            text-align: left;
            font-size: 13px;
          }
          th {
            background: rgba(14, 165, 164, 0.08);
            color: var(--brand);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-size: 11px;
          }
          td.num {
            text-align: right;
          }
          .split {
            display: grid;
            grid-template-columns: 1.4fr 0.8fr;
            gap: 18px;
            margin-top: 18px;
          }
          .summary {
            padding: 12px 16px;
          }
          .summary-row.emphasis {
            font-size: 16px;
          }
          .gst-breakup {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--line);
            font-size: 13px;
            color: var(--muted);
          }
          .gst-breakup strong {
            color: var(--ink);
          }
          .notes {
            margin-top: 18px;
            padding: 16px 18px;
            border-radius: 16px;
            background: #fff8e8;
            border: 1px solid #f1ddad;
          }
          .notes h3 {
            margin: 0 0 10px;
          }
          .notes ul {
            margin: 0;
            padding-left: 18px;
          }
          .footer {
            margin-top: 22px;
            color: var(--muted);
            font-size: 12px;
          }
          @media print {
            body { background: white; }
            .sheet { margin: 0; width: auto; min-height: auto; }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <section class="topbar">
            <div>
              <span class="eyebrow">${invoice.type === 'purchase' ? 'Purchase Side' : 'Seller Side'}</span>
              <h1>${escapeHtml(getInvoiceHeading(invoice))}</h1>
              <p style="margin:8px 0 0;color:#5b6f8f;">Invoice No. ${escapeHtml(invoice.invoiceNumber || 'Draft')}</p>
            </div>
            <aside class="meta">${metaRows}</aside>
          </section>

          <section class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Item Type</th>
                  <th style="text-align:right;">Qty</th>
                  <th style="text-align:right;">Rate</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </section>

          <section class="split">
            <div class="summary">
              ${summaryRows}
              <div class="gst-breakup">
                <div>CGST: <strong>${escapeHtml(formatCurrency(invoice.gstBreakup.cgst))}</strong></div>
                <div>SGST: <strong>${escapeHtml(formatCurrency(invoice.gstBreakup.sgst))}</strong></div>
                <div>IGST: <strong>${escapeHtml(formatCurrency(invoice.gstBreakup.igst))}</strong></div>
              </div>
            </div>
            <div class="summary">
              <div class="summary-row">
                <span>TDS Mode</span>
                <strong>${invoice.tds.enabled ? escapeHtml(invoice.tds.isInformational ? 'Informational note' : 'Deduct from payable') : 'Not applied'}</strong>
              </div>
              <div class="summary-row">
                <span>TDS Amount</span>
                <strong>${escapeHtml(formatCurrency(invoice.tds.amount))}</strong>
              </div>
              <div class="summary-row">
                <span>TCS Amount</span>
                <strong>${escapeHtml(formatCurrency(invoice.tcs.amount))}</strong>
              </div>
              <div class="summary-row emphasis">
                <span>Gross Invoice</span>
                <strong>${escapeHtml(formatCurrency(invoice.total))}</strong>
              </div>
            </div>
          </section>

          ${
            notes
              ? `
                <section class="notes">
                  <h3>Compliance Notes</h3>
                  <ul>${notes}</ul>
                </section>
              `
              : ''
          }

          <p class="footer">Generated from Metrox TaxInvoo with GST + TDS/TCS compliance view.</p>
        </main>
      </body>
    </html>
  `;
}

export function exportInvoiceToPdf(invoice) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900');
  if (!popup) {
    throw new Error('Please allow pop-ups to export the invoice.');
  }

  popup.document.open();
  popup.document.write(buildInvoicePrintHtml(invoice));
  popup.document.close();
  popup.focus();
  popup.onload = () => {
    popup.print();
  };
}

import { formatCurrency, formatPercent } from '../../utils/invoiceCalculations.js';
import {
  getInvoiceHeading,
  getInvoiceMetaRows,
  getInvoiceNotes,
  getInvoiceSummaryRows,
  getInvoiceTableRows
} from '../../utils/invoiceTemplate.js';

export default function InvoicePreview({ invoice }) {
  const metaRows = getInvoiceMetaRows(invoice);
  const summaryRows = getInvoiceSummaryRows(invoice);
  const notes = getInvoiceNotes(invoice);
  const tableRows = getInvoiceTableRows(invoice);

  return (
    <section className="invoice-preview card-soft">
      <div className="preview-topbar">
        <div>
          <span className="preview-eyebrow">{invoice.type === 'purchase' ? 'Purchase-side' : 'Seller-side'}</span>
          <h3>{getInvoiceHeading(invoice)}</h3>
          <p>{invoice.invoiceNumber || 'Draft invoice number pending'}</p>
        </div>
        <div className="preview-meta">
          {metaRows.map((row) => (
            <div key={row.label} className="preview-meta-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="preview-table">
        <div className="preview-table-head">
          <span>#</span>
          <span>Description</span>
          <span>Type</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Amount</span>
        </div>
        {tableRows.map((row) => (
          <div key={row.id} className="preview-table-row">
            <span>{row.index}</span>
            <span>{row.description}</span>
            <span>{row.itemType}</span>
            <span>{row.quantity}</span>
            <span>{row.rate}</span>
            <span>{row.lineTotal}</span>
          </div>
        ))}
      </div>

      <div className="preview-bottom">
        <div className="preview-summary">
          {summaryRows.map((row) => (
            <div key={row.label} className={`preview-summary-row ${row.emphasis ? 'emphasis' : ''}`.trim()}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
          <div className="preview-tax-breakup">
            <div>CGST: <strong>{formatCurrency(invoice.gstBreakup.cgst)}</strong></div>
            <div>SGST: <strong>{formatCurrency(invoice.gstBreakup.sgst)}</strong></div>
            <div>IGST: <strong>{formatCurrency(invoice.gstBreakup.igst)}</strong></div>
            <div>GST Rate: <strong>{formatPercent(invoice.gstRate)}</strong></div>
          </div>
        </div>

        <div className="preview-tax-card">
          <div className="preview-summary-row">
            <span>TDS Treatment</span>
            <strong>{invoice.tds.enabled ? (invoice.tds.isInformational ? 'Informational only' : 'Deduct from payable') : 'Not applied'}</strong>
          </div>
          <div className="preview-summary-row">
            <span>TDS Amount</span>
            <strong>{formatCurrency(invoice.tds.amount)}</strong>
          </div>
          <div className="preview-summary-row">
            <span>TCS Amount</span>
            <strong>{formatCurrency(invoice.tcs.amount)}</strong>
          </div>
          <div className="preview-summary-row emphasis">
            <span>Gross Invoice</span>
            <strong>{formatCurrency(invoice.total)}</strong>
          </div>
        </div>
      </div>

      {notes.length ? (
        <div className="preview-notes">
          <h4>Compliance Notes</h4>
          <ul>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

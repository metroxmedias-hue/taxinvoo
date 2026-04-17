import { useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import CheckboxField from '../components/ui/CheckboxField.jsx';
import InputField from '../components/ui/InputField.jsx';
import InvoicePreview from '../components/invoice/InvoicePreview.jsx';
import { createInvoice } from '../services/invoiceApi.js';
import { getCachedCustomers, getCustomerById } from '../services/customerApi.js';
import useInvoiceStore from '../stores/useInvoiceStore.js';
import { formatCurrency, getSupplyTypeLabel } from '../utils/invoiceCalculations.js';
import { exportInvoiceToPdf } from '../utils/invoicePrint.js';
import { formatApiError } from '../utils/formatError.js';
import { getTenant } from '../utils/tenant.js';

export default function CreateInvoicePage() {
  const tenant = useMemo(() => getTenant(), []);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [customers, setCustomers] = useState(() => getCachedCustomers(tenant.businessId));
  const draft = useInvoiceStore((state) => state.draft);
  const invoice = useInvoiceStore((state) => state.invoice);
  const setInvoiceField = useInvoiceStore((state) => state.setInvoiceField);
  const setParty = useInvoiceStore((state) => state.setParty);
  const setTaxField = useInvoiceStore((state) => state.setTaxField);
  const toggleTax = useInvoiceStore((state) => state.toggleTax);
  const addItem = useInvoiceStore((state) => state.addItem);
  const updateItem = useInvoiceStore((state) => state.updateItem);
  const removeItem = useInvoiceStore((state) => state.removeItem);
  const applySuggestion = useInvoiceStore((state) => state.applySuggestion);
  const resetDraft = useInvoiceStore((state) => state.resetDraft);

  function validateCommon() {
    if (!draft.invoiceNumber.trim()) {
      setMessage('Invoice Number is required.');
      return false;
    }
    if (!draft.partyName.trim()) {
      setMessage('Customer / supplier name is required.');
      return false;
    }
    if (!Number.isFinite(Number(draft.gstRate)) || Number(draft.gstRate) < 0) {
      setMessage('GST rate must be a valid non-negative number.');
      return false;
    }
    if (invoice.tds.enabled && (!Number.isFinite(Number(draft.tds.rate)) || Number(draft.tds.rate) < 0)) {
      setMessage('TDS rate must be a valid non-negative number.');
      return false;
    }
    if (invoice.tcs.enabled && (!Number.isFinite(Number(draft.tcs.rate)) || Number(draft.tcs.rate) < 0)) {
      setMessage('TCS rate must be a valid non-negative number.');
      return false;
    }
    const hasInvalidItem = invoice.items.some((line) => {
      return !line.description?.trim() || line.quantity <= 0 || line.rate < 0;
    });
    if (hasInvalidItem) {
      setMessage('Each item must have description, quantity > 0 and rate >= 0.');
      return false;
    }
    return true;
  }

  function validateForApiSave() {
    if (!validateCommon()) {
      return false;
    }
    if (!tenant.businessId || !tenant.userId) {
      setMessage('Please set Business ID and User ID in Tenant Context.');
      return false;
    }
    if (invoice.type !== 'sales') {
      setMessage('Purchase invoices are currently export-ready in the frontend, but API save is limited to sales invoices in the current backend.');
      return false;
    }
    if (!draft.partyId.trim()) {
      setMessage('Select a saved customer to use the current API save flow.');
      return false;
    }
    return true;
  }

  async function addCustomerByIdLookup() {
    if (!draft.partyId.trim()) return;
    try {
      const customer = await getCustomerById(draft.partyId.trim());
      setCustomers((prev) => [customer, ...prev.filter((c) => c.id !== customer.id)]);
      setParty(customer);
      setMessage('Customer loaded from API and added to dropdown.');
    } catch (error) {
      setMessage(formatApiError(error));
    }
  }

  function onPartySelect(value) {
    const selected = customers.find((customer) => customer.id === value);
    if (selected) {
      setParty(selected);
      return;
    }

    setParty({ id: value, customerName: '', gstin: '' });
  }

  function downloadJson() {
    if (!validateCommon()) return;

    const blob = new Blob([JSON.stringify(invoice, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.invoiceNumber || 'invoice'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExportMessage('Structured invoice JSON downloaded.');
  }

  function handlePdfExport() {
    if (!validateCommon()) return;

    try {
      exportInvoiceToPdf(invoice);
      setExportMessage('PDF export opened in the print dialog.');
    } catch (error) {
      setExportMessage(error.message);
    }
  }

  async function onSaveSalesInvoice(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setExportMessage('');
    if (!validateForApiSave()) {
      setLoading(false);
      return;
    }

    try {
      const payload = {
        invoiceNumber: draft.invoiceNumber.trim(),
        sellerId: tenant.businessId,
        customerId: draft.partyId.trim(),
        items: invoice.items.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          rate: line.rate
        }))
      };

      await createInvoice(payload);
      setMessage('Sales invoice saved to the API. Compliance totals in the live preview remain the source of truth for TDS/TCS handling.');
    } catch (error) {
      setMessage(formatApiError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page card invoice-workspace">
      <header className="page-header">
        <h2>Advanced GST + TDS/TCS Invoice Studio</h2>
        <p>Build sales or purchase invoices with strict GST, TDS, TCS, conflict handling, and PDF-ready preview.</p>
      </header>

      <div className="invoice-grid">
        <form className="form-grid invoice-form-panel" onSubmit={onSaveSalesInvoice}>
          <div className="span-2 hero-strip">
            <div className="hero-stat card-soft">
              <span>Invoice Mode</span>
              <strong>{invoice.type === 'purchase' ? 'Purchase Invoice' : 'Sales Invoice'}</strong>
              <small>{invoice.type === 'purchase' ? 'TDS impacts payable amount' : 'TCS can increase invoice total'}</small>
            </div>
            <div className="hero-stat card-soft">
              <span>Compliance Status</span>
              <strong>{invoice.warnings.length ? 'Needs review' : 'Rule-safe'}</strong>
              <small>{invoice.warnings.length ? invoice.warnings[0] : 'No active TDS/TCS conflict detected.'}</small>
            </div>
            <div className="hero-stat card-soft">
              <span>Net Outcome</span>
              <strong>{formatCurrency(invoice.type === 'purchase' ? invoice.payableAmount : invoice.total)}</strong>
              <small>{invoice.type === 'purchase' ? 'Final payable after TDS deduction' : 'Customer-facing invoice total'}</small>
            </div>
          </div>

          <label className="field">
            <span className="field-label">Invoice Side *</span>
            <select className="field-control" value={draft.type} onChange={(e) => setInvoiceField('type', e.target.value)}>
              <option value="sales">Sales</option>
              <option value="purchase">Purchase</option>
            </select>
          </label>

          <InputField
            label="Invoice Number"
            required
            value={draft.invoiceNumber}
            onChange={(e) => setInvoiceField('invoiceNumber', e.target.value)}
          />

          <InputField
            label="Invoice Date"
            type="date"
            value={draft.invoiceDate}
            onChange={(e) => setInvoiceField('invoiceDate', e.target.value)}
          />

          <label className="field">
            <span className="field-label">Select Customer / Supplier</span>
            <select className="field-control" value={draft.partyId} onChange={(e) => onPartySelect(e.target.value)}>
              <option value="">Select saved party</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerName || customer.id}
                </option>
              ))}
            </select>
          </label>

          <InputField
            className="span-2"
            label={draft.type === 'purchase' ? 'Supplier Name *' : 'Buyer Name *'}
            required
            value={draft.partyName}
            onChange={(e) => setInvoiceField('partyName', e.target.value)}
          />

          <InputField
            label="Party GSTIN"
            value={draft.partyGstin}
            onChange={(e) => setInvoiceField('partyGstin', e.target.value)}
          />

          <div className="field">
            <span className="field-label">GST Treatment</span>
            <select className="field-control" value={draft.gstMode} onChange={(e) => setInvoiceField('gstMode', e.target.value)}>
              <option value="intra">Intra-state (CGST + SGST)</option>
              <option value="inter">Inter-state (IGST)</option>
            </select>
          </div>

          <InputField
            label="GST Rate %"
            type="number"
            min="0"
            step="0.01"
            value={draft.gstRate}
            onChange={(e) => setInvoiceField('gstRate', e.target.value)}
          />

          <div className="span-2 inline-actions">
            <Button type="button" onClick={addCustomerByIdLookup}>Load Selected Party from API</Button>
          </div>

          {invoice.suggestion ? (
            <div className="span-2 suggestion-card card-soft">
              <div>
                <strong>{invoice.suggestion.title}</strong>
                <p>{invoice.suggestion.description}</p>
              </div>
              <Button type="button" onClick={applySuggestion}>Apply Suggestion</Button>
            </div>
          ) : null}

          {invoice.warnings.length ? (
            <div className="span-2 warning-stack">
              {invoice.warnings.map((warning) => (
                <div key={warning} className="warning-banner">{warning}</div>
              ))}
            </div>
          ) : null}

          <div className="span-2 invoice-lines">
            <div className="line-head">
              <div>
                <strong>Invoice Items</strong>
                <div className="muted-line">
                  {invoice.metrics.goodsLines} goods lines, {invoice.metrics.serviceLines} service lines
                </div>
              </div>
              <Button type="button" onClick={addItem}>+ Add Row</Button>
            </div>

            {invoice.items.map((line) => (
              <div key={line.id} className="line-row advanced">
                <InputField
                  label="Description"
                  value={line.description}
                  onChange={(e) => updateItem(line.id, 'description', e.target.value)}
                />
                <label className="field">
                  <span className="field-label">Item Type</span>
                  <select className="field-control" value={line.itemType} onChange={(e) => updateItem(line.id, 'itemType', e.target.value)}>
                    <option value="goods">Goods</option>
                    <option value="service">Service</option>
                  </select>
                </label>
                <InputField
                  label="Qty"
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantity}
                  onChange={(e) => updateItem(line.id, 'quantity', e.target.value)}
                />
                <InputField
                  label="Rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.rate}
                  onChange={(e) => updateItem(line.id, 'rate', e.target.value)}
                />
                <div className="line-readonly">
                  <span className="field-label">Line Total</span>
                  <strong>{formatCurrency(line.lineTotal)}</strong>
                  <small>{getSupplyTypeLabel(line.itemType)}</small>
                </div>
                <div className="line-remove-wrap">
                  <Button type="button" onClick={() => removeItem(line.id)} className="btn-danger">Remove</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="span-2 compliance-panel card-soft">
            <div className="line-head">
              <div>
                <strong>Compliance Controls</strong>
                <div className="muted-line">TDS reduces receivable/payable only on purchase invoices. TCS adds to the total only on sales invoices.</div>
              </div>
            </div>

            <div className="toggle-grid">
              <div className="toggle-card">
                <CheckboxField
                  label={invoice.ui.tdsLabel}
                  checked={draft.tds.enabled}
                  onChange={(e) => toggleTax('tds', e.target.checked)}
                />
                <p>{invoice.ui.informationalTds ? 'Buyer deduction note only. Invoice total stays unchanged.' : 'Active deduction. Final payable is reduced by TDS.'}</p>
                <div className="mini-grid">
                  <InputField
                    label="TDS Section"
                    placeholder={draft.type === 'purchase' ? '194Q / 194J' : '194J'}
                    value={draft.tds.section}
                    onChange={(e) => setTaxField('tds', 'section', e.target.value)}
                  />
                  <InputField
                    label="TDS Rate %"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.tds.rate}
                    onChange={(e) => setTaxField('tds', 'rate', e.target.value)}
                  />
                </div>
              </div>

              <div className={`toggle-card ${invoice.ui.tcsDisabled ? 'disabled' : ''}`.trim()}>
                <CheckboxField
                  label="Apply TCS"
                  checked={draft.tcs.enabled && !invoice.ui.tcsDisabled}
                  onChange={(e) => toggleTax('tcs', e.target.checked)}
                  disabled={invoice.ui.tcsDisabled}
                />
                <p>{invoice.ui.tcsDisabled ? invoice.ui.tcsDisableReason : 'Seller-side collection. TCS increases the customer-facing invoice total.'}</p>
                <div className="mini-grid">
                  <InputField
                    label="TCS Section"
                    placeholder="206C(1H)"
                    value={draft.tcs.section}
                    onChange={(e) => setTaxField('tcs', 'section', e.target.value)}
                    disabled={invoice.ui.tcsDisabled}
                  />
                  <InputField
                    label="TCS Rate %"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.tcs.rate}
                    onChange={(e) => setTaxField('tcs', 'rate', e.target.value)}
                    disabled={invoice.ui.tcsDisabled}
                  />
                </div>
              </div>
            </div>
          </div>

          <InputField
            className="span-2"
            label="Internal Notes / PDF Footer Note"
            as="textarea"
            rows="4"
            value={draft.notes}
            onChange={(e) => setInvoiceField('notes', e.target.value)}
          />

          <div className="span-2 tax-result card-soft">
            <h3>Live Tax Summary</h3>
            <div className="stat-row"><span>Subtotal</span><strong>{formatCurrency(invoice.subtotal)}</strong></div>
            <div className="stat-row"><span>GST</span><strong>{formatCurrency(invoice.gst)}</strong></div>
            <div className="stat-row"><span>TDS</span><strong>{invoice.tds.enabled ? formatCurrency(invoice.tds.amount) : 'Not applied'}</strong></div>
            <div className="stat-row"><span>TCS</span><strong>{invoice.tcs.enabled ? formatCurrency(invoice.tcs.amount) : 'Not applied'}</strong></div>
            <div className="stat-row total"><span>Invoice Total</span><strong>{formatCurrency(invoice.total)}</strong></div>
            <div className="stat-row total"><span>{invoice.type === 'purchase' ? 'Final Payable' : 'Receivable'}</span><strong>{formatCurrency(invoice.type === 'purchase' ? invoice.payableAmount : invoice.total)}</strong></div>
          </div>

          <div className="form-actions span-2 action-bar">
            <Button type="submit" loading={loading}>Save Sales Invoice</Button>
            <Button type="button" onClick={handlePdfExport}>Export PDF</Button>
            <Button type="button" onClick={downloadJson}>Download JSON</Button>
            <Button type="button" onClick={resetDraft} className="btn-secondary">Reset Draft</Button>
          </div>
        </form>

        <InvoicePreview invoice={invoice} />
      </div>

      {message ? <div className="status">{message}</div> : null}
      {exportMessage ? <div className="status">{exportMessage}</div> : null}
    </section>
  );
}

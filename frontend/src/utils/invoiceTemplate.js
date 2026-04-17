import { formatCurrency, formatPercent, getSupplyTypeLabel } from './invoiceCalculations.js';

export function getInvoiceHeading(invoice) {
  return invoice.type === 'purchase' ? 'Purchase Invoice' : 'Tax Sales Invoice';
}

export function getInvoiceSummaryRows(invoice) {
  const rows = [
    { label: 'Subtotal', value: formatCurrency(invoice.subtotal) },
    { label: `GST (${formatPercent(invoice.gstRate)})`, value: formatCurrency(invoice.gst) }
  ];

  if (invoice.type === 'sales' && invoice.tcs.enabled) {
    rows.push({
      label: `TCS${invoice.tcs.section ? ` (${invoice.tcs.section})` : ''}`,
      value: formatCurrency(invoice.tcs.amount)
    });
  }

  if (invoice.type === 'purchase' && invoice.tds.enabled) {
    rows.push({
      label: `TDS Deduction${invoice.tds.section ? ` (${invoice.tds.section})` : ''}`,
      value: `- ${formatCurrency(invoice.tds.amount)}`
    });
  }

  rows.push({
    label: invoice.type === 'purchase' ? 'Final Payable' : 'Total',
    value: formatCurrency(invoice.type === 'purchase' ? invoice.payableAmount : invoice.total),
    emphasis: true
  });

  return rows;
}

export function getInvoiceNotes(invoice) {
  const notes = [];

  if (invoice.type === 'sales' && invoice.tds.enabled) {
    notes.push(`Note: TDS of ${formatCurrency(invoice.tds.amount)} will be deducted by the buyer.`);
  }

  if (invoice.warnings?.length) {
    notes.push(...invoice.warnings);
  }

  if (invoice.notes) {
    notes.push(invoice.notes);
  }

  return notes;
}

export function getInvoiceMetaRows(invoice) {
  return [
    { label: 'Invoice Type', value: invoice.type === 'purchase' ? 'Purchase' : 'Sales' },
    { label: 'Invoice Date', value: invoice.invoiceDate || 'Not set' },
    { label: 'Party', value: invoice.partyName || 'Counterparty pending' },
    { label: 'GST Mode', value: invoice.gstMode === 'inter' ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)' }
  ];
}

export function getInvoiceTableRows(invoice) {
  return invoice.items.map((item, index) => ({
    id: item.id || `row-${index + 1}`,
    index: index + 1,
    description: item.description || 'Draft item',
    itemType: getSupplyTypeLabel(item.itemType),
    quantity: item.quantity,
    rate: formatCurrency(item.rate),
    lineTotal: formatCurrency(item.lineTotal)
  }));
}

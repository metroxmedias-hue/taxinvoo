const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const CONFLICT_WARNING = 'TCS is not applicable when TDS is deducted (as per Sec 194Q vs 206C).';

const SUPPLY_TYPE_LABELS = {
  goods: 'Goods',
  service: 'Service'
};

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createId() {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

export function formatPercent(value) {
  return `${percentFormatter.format(numberOrZero(value))}%`;
}

export function createInvoiceLine() {
  return {
    id: createId(),
    description: '',
    itemType: 'goods',
    quantity: 1,
    rate: 0
  };
}

export function createEmptyInvoiceDraft() {
  return {
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    type: 'sales',
    partyId: '',
    partyName: '',
    partyGstin: '',
    gstMode: 'intra',
    gstRate: 18,
    notes: '',
    items: [createInvoiceLine()],
    tds: {
      enabled: false,
      section: '',
      rate: 0,
      amount: 0,
      isInformational: true
    },
    tcs: {
      enabled: false,
      section: '',
      rate: 0,
      amount: 0
    }
  };
}

function getSupplyMix(items) {
  return items.reduce(
    (acc, item) => {
      const key = item.itemType === 'service' ? 'service' : 'goods';
      acc[key] += 1;
      return acc;
    },
    { goods: 0, service: 0 }
  );
}

export function getSuggestedTaxProfile(type, items) {
  const mix = getSupplyMix(items);
  if (!mix.goods && !mix.service) {
    return null;
  }

  if (type === 'purchase') {
    if (mix.service > 0) {
      return {
        mode: 'tds',
        section: '194J',
        rate: 10,
        title: 'Suggested: TDS on services',
        description: 'Service purchases often require buyer-side TDS. Review the applicable 194J rate for the service category.'
      };
    }

    return {
      mode: 'tds',
      section: '194Q',
      rate: 0.1,
      title: 'Suggested: TDS on goods purchase',
      description: 'Goods purchases can fall under Sec 194Q, where TDS is deducted by the buyer and reduces the payable amount.'
    };
  }

  if (mix.service > 0) {
    return {
      mode: 'tds',
      section: '194J',
      rate: 10,
      title: 'Suggested: buyer-side TDS note',
      description: 'Service sales commonly carry a TDS note for buyer deduction. In this sales invoice, TDS stays informational and does not reduce the total.'
    };
  }

  return {
    mode: 'tcs',
    section: '206C(1H)',
    rate: 0.1,
    title: 'Suggested: TCS on sale of goods',
    description: 'Goods sales may attract seller-side TCS under Sec 206C(1H), which adds to the invoice total.'
  };
}

export function calculateInvoice(draft) {
  const safeItems = Array.isArray(draft.items) && draft.items.length ? draft.items : [createInvoiceLine()];
  const items = safeItems.map((item) => {
    const quantity = numberOrZero(item.quantity);
    const rate = numberOrZero(item.rate);
    const lineTotal = round2(quantity * rate);

    return {
      ...item,
      itemType: item.itemType === 'service' ? 'service' : 'goods',
      quantity,
      rate,
      lineTotal
    };
  });

  const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const gstRate = numberOrZero(draft.gstRate);
  const gst = round2(subtotal * (gstRate / 100));
  const gstBreakup =
    draft.gstMode === 'inter'
      ? { cgst: 0, sgst: 0, igst: gst }
      : { cgst: round2(gst / 2), sgst: round2(gst / 2), igst: 0 };

  const rawTdsEnabled = Boolean(draft.tds?.enabled);
  const rawTcsEnabled = Boolean(draft.tcs?.enabled);
  const warnings = [];

  let tdsEnabled = rawTdsEnabled;
  let tcsEnabled = rawTcsEnabled;

  if (draft.type === 'purchase' && rawTcsEnabled) {
    tcsEnabled = false;
    warnings.push('TCS is disabled for purchase invoices because seller-side collection is not applicable here.');
  }

  if (rawTdsEnabled && rawTcsEnabled) {
    tcsEnabled = false;
    warnings.push(CONFLICT_WARNING);
  }

  const tdsRate = numberOrZero(draft.tds?.rate);
  const tcsRate = numberOrZero(draft.tcs?.rate);
  const tdsAmount = tdsEnabled ? round2(subtotal * (tdsRate / 100)) : 0;
  const tcsAmount = draft.type === 'sales' && tcsEnabled ? round2(subtotal * (tcsRate / 100)) : 0;
  const total = round2(subtotal + gst + tcsAmount);
  const payableAmount = draft.type === 'purchase' ? round2(Math.max(total - tdsAmount, 0)) : total;
  const suggestion = getSuggestedTaxProfile(draft.type, items);
  const supplyMix = getSupplyMix(items);
  const isMixedSupply = supplyMix.goods > 0 && supplyMix.service > 0;

  if (isMixedSupply) {
    warnings.push('Mixed goods and service lines detected. Review the selected TDS/TCS section before finalizing the invoice.');
  }

  return {
    invoiceNumber: draft.invoiceNumber,
    invoiceDate: draft.invoiceDate,
    partyId: draft.partyId,
    partyName: draft.partyName,
    partyGstin: draft.partyGstin,
    type: draft.type,
    gstMode: draft.gstMode,
    gstRate,
    subtotal,
    gst,
    gstBreakup,
    items,
    notes: draft.notes,
    tds: {
      enabled: tdsEnabled,
      section: String(draft.tds?.section || '').trim(),
      rate: tdsRate,
      amount: tdsAmount,
      isInformational: draft.type === 'sales'
    },
    tcs: {
      enabled: draft.type === 'sales' ? tcsEnabled : false,
      section: String(draft.tcs?.section || '').trim(),
      rate: tcsRate,
      amount: tcsAmount
    },
    total,
    payableAmount,
    warnings,
    suggestion,
    ui: {
      tdsLabel: draft.type === 'sales' ? 'Apply TDS (info only)' : 'Apply TDS',
      tcsDisabled: draft.type === 'purchase' || tdsEnabled,
      tcsDisableReason:
        draft.type === 'purchase'
          ? 'TCS is available only on sales invoices.'
          : tdsEnabled
            ? CONFLICT_WARNING
            : '',
      informationalTds: draft.type === 'sales'
    },
    metrics: {
      goodsLines: supplyMix.goods,
      serviceLines: supplyMix.service,
      mixedSupply: isMixedSupply
    }
  };
}

export function getSupplyTypeLabel(value) {
  return SUPPLY_TYPE_LABELS[value] || 'Goods';
}

export function getConflictWarning() {
  return CONFLICT_WARNING;
}

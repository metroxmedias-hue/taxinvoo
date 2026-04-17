import { create } from 'zustand';
import {
  calculateInvoice,
  createEmptyInvoiceDraft,
  createInvoiceLine
} from '../utils/invoiceCalculations.js';

function withComputedDraft(draft) {
  return {
    draft,
    invoice: calculateInvoice(draft)
  };
}

const initialDraft = createEmptyInvoiceDraft();

const useInvoiceStore = create((set, get) => ({
  ...withComputedDraft(initialDraft),

  resetDraft() {
    set(withComputedDraft(createEmptyInvoiceDraft()));
  },

  setInvoiceField(field, value) {
    set((state) => {
      const nextDraft = { ...state.draft, [field]: value };
      if (field === 'type' && value === 'purchase') {
        nextDraft.tcs = {
          ...nextDraft.tcs,
          enabled: false
        };
      }
      return withComputedDraft(nextDraft);
    });
  },

  setParty(party) {
    set((state) =>
      withComputedDraft({
        ...state.draft,
        partyId: party?.id || '',
        partyName: party?.customerName || party?.partyName || '',
        partyGstin: party?.gstin || ''
      })
    );
  },

  setTaxField(kind, field, value) {
    set((state) =>
      withComputedDraft({
        ...state.draft,
        [kind]: {
          ...state.draft[kind],
          [field]: value
        }
      })
    );
  },

  toggleTax(kind, enabled) {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        [kind]: {
          ...state.draft[kind],
          enabled
        }
      };

      if (kind === 'tds' && enabled) {
        nextDraft.tcs = {
          ...state.draft.tcs,
          enabled: false
        };
      }

      if (kind === 'tcs' && enabled && (state.draft.type === 'purchase' || state.draft.tds.enabled)) {
        nextDraft.tcs = {
          ...state.draft.tcs,
          enabled: false
        };
      }

      return withComputedDraft(nextDraft);
    });
  },

  addItem() {
    set((state) =>
      withComputedDraft({
        ...state.draft,
        items: [...state.draft.items, createInvoiceLine()]
      })
    );
  },

  updateItem(itemId, field, value) {
    set((state) =>
      withComputedDraft({
        ...state.draft,
        items: state.draft.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                [field]: value
              }
            : item
        )
      })
    );
  },

  removeItem(itemId) {
    set((state) => {
      const nextItems = state.draft.items.filter((item) => item.id !== itemId);
      return withComputedDraft({
        ...state.draft,
        items: nextItems.length ? nextItems : [createInvoiceLine()]
      });
    });
  },

  applySuggestion() {
    const suggestion = get().invoice.suggestion;
    if (!suggestion) return;

    set((state) => {
      const nextDraft = {
        ...state.draft,
        tds: {
          ...state.draft.tds,
          enabled: suggestion.mode === 'tds',
          section: suggestion.mode === 'tds' ? suggestion.section : state.draft.tds.section,
          rate: suggestion.mode === 'tds' ? suggestion.rate : state.draft.tds.rate
        },
        tcs: {
          ...state.draft.tcs,
          enabled: suggestion.mode === 'tcs',
          section: suggestion.mode === 'tcs' ? suggestion.section : state.draft.tcs.section,
          rate: suggestion.mode === 'tcs' ? suggestion.rate : state.draft.tcs.rate
        }
      };

      if (suggestion.mode === 'tds') {
        nextDraft.tcs.enabled = false;
      }

      return withComputedDraft(nextDraft);
    });
  }
}));

export default useInvoiceStore;

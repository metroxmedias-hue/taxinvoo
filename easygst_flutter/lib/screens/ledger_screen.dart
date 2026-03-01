import 'package:flutter/material.dart';

import '../models/app_state.dart';

class LedgerScreen extends StatelessWidget {
  const LedgerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Ledger')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Today\'s ledger', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          _LedgerCard(
            items: [
              ...appState.recentInvoices.map(
                (inv) => _LedgerItem(inv.customer, appState.formatCurrency(inv.total)),
              ),
              ...appState.recentExpenses.map(
                (exp) => _LedgerItem(exp.title, '-${appState.formatCurrency(exp.amount)}'),
              ),
              if (appState.recentInvoices.isEmpty && appState.recentExpenses.isEmpty)
                const _LedgerItem('No activity yet', '—'),
            ],
          ),
          const SizedBox(height: 20),
          const Text('Monthly summary', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          _LedgerCard(items: [
            _LedgerItem('Total sales', appState.formatCurrency(appState.totalSales)),
            _LedgerItem('Expenses', '-${appState.formatCurrency(appState.totalExpenses)}'),
            _LedgerItem('Profit', appState.formatCurrency(appState.profit)),
            _LedgerItem('GST payable', appState.formatCurrency(appState.gstPayable)),
          ]),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        icon: const Icon(Icons.add),
        label: const Text('Add expense'),
      ),
    );
  }
}

class _LedgerCard extends StatelessWidget {
  final List<_LedgerItem> items;

  const _LedgerCard({required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        color: Colors.white,
      ),
      child: Column(
        children: items
            .map(
              (item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(item.label),
                    Text(item.value, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _LedgerItem {
  final String label;
  final String value;

  const _LedgerItem(this.label, this.value);
}

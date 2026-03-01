import 'package:flutter/material.dart';

import '../models/app_state.dart';

class CustomerDetailScreen extends StatelessWidget {
  final String customerName;

  const CustomerDetailScreen({super.key, required this.customerName});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final invoices = appState.invoicesForCustomer(customerName);
    final totalBilled = invoices.fold(0.0, (sum, inv) => sum + inv.total);
    final totalPaid = invoices.fold(0.0, (sum, inv) => sum + inv.paidAmount);
    final totalDue = (totalBilled - totalPaid).clamp(0, totalBilled);

    return Scaffold(
      appBar: AppBar(title: Text(customerName)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _SummaryCard(
            billed: appState.formatCurrency(totalBilled),
            paid: appState.formatCurrency(totalPaid),
            due: appState.formatCurrency(totalDue),
          ),
          const SizedBox(height: 16),
          const Text('Invoices', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (invoices.isEmpty) const Text('No invoices yet.'),
          ...invoices.map(
            (invoice) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                title: Text('#${invoice.id} • ${appState.formatCurrency(invoice.total)}'),
                subtitle: Text('Status: ${invoice.status.name.toUpperCase()}'),
                trailing: Text('Due: ${appState.formatCurrency(invoice.dueAmount)}'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String billed;
  final String paid;
  final String due;

  const _SummaryCard({required this.billed, required this.paid, required this.due});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          _Row(label: 'Total billed', value: billed),
          _Row(label: 'Total paid', value: paid),
          _Row(label: 'Total due', value: due),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;

  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade700)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

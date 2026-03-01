import 'package:flutter/material.dart';

import '../models/app_state.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          TextButton(
            onPressed: () {},
            child: const Text('Invite'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Today at a glance',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.6,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            children: [
              _MetricCard(title: 'Sales today', value: appState.formatCurrency(appState.totalSales)),
              _MetricCard(title: 'Revenue (month)', value: appState.formatCurrency(appState.totalSales)),
              _MetricCard(title: 'Paid so far', value: appState.formatCurrency(appState.totalPaid)),
              _MetricCard(title: 'GST payable', value: appState.formatCurrency(appState.gstPayable)),
            ],
          ),
          const SizedBox(height: 20),
          const _SectionTitle('Recent invoices'),
          const SizedBox(height: 8),
          _ListCard(
            items: appState.recentInvoices.isEmpty
                ? ['No invoices yet.']
                : appState.recentInvoices
                    .map((inv) => '${inv.customer} • #${inv.id} • ${appState.formatCurrency(inv.total)}')
                    .toList(),
          ),
          const SizedBox(height: 20),
          const _SectionTitle('Recent expenses'),
          const SizedBox(height: 8),
          _ListCard(
            items: appState.recentExpenses.isEmpty
                ? ['No expenses yet.']
                : appState.recentExpenses
                    .map((exp) => '${exp.title} • ${appState.formatCurrency(exp.amount)}')
                    .toList(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        label: const Text('New invoice'),
        icon: const Icon(Icons.receipt_long),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;

  const _MetricCard({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: TextStyle(color: Colors.grey.shade700, fontSize: 12)),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;

  const _SectionTitle(this.title);

  @override
  Widget build(BuildContext context) {
    return Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600));
  }
}

class _ListCard extends StatelessWidget {
  final List<String> items;

  const _ListCard({required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        color: Colors.white,
      ),
      child: Column(
        children: items
            .map(
              (item) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(item),
                trailing: const Icon(Icons.chevron_right),
              ),
            )
            .toList(),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../models/app_state.dart';
import 'customer_detail_screen.dart';

class CustomerListScreen extends StatelessWidget {
  const CustomerListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final customers = appState.customers;

    return Scaffold(
      appBar: AppBar(title: const Text('Customers')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (customers.isEmpty)
            const Text('No customers yet. Create an invoice to get started.'),
          ...customers.map(
            (customer) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                title: Text(customer.name),
                subtitle: Text(
                  'Billed: ${appState.formatCurrency(customer.totalBilled)} • '
                  'Due: ${appState.formatCurrency(customer.due)}',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CustomerDetailScreen(customerName: customer.name),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../models/app_state.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _amountController = TextEditingController();
  String _category = 'rent';

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Expenses')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Track expenses', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          TextField(
            controller: _titleController,
            decoration: InputDecoration(
              labelText: 'Expense description',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Amount (₹)',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            items: const [
              DropdownMenuItem(value: 'rent', child: Text('Rent')),
              DropdownMenuItem(value: 'travel', child: Text('Travel')),
              DropdownMenuItem(value: 'ads', child: Text('Advertising')),
              DropdownMenuItem(value: 'inventory', child: Text('Inventory')),
            ],
            onChanged: (value) => setState(() => _category = value ?? 'rent'),
            decoration: InputDecoration(
              labelText: 'Category',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                final title = _titleController.text.trim();
                final amount = double.tryParse(_amountController.text) ?? 0;
                if (title.isEmpty || amount <= 0) return;
                appState.addExpense(
                  Expense(
                    id: appState.nextExpenseId(),
                    title: title,
                    category: _category,
                    amount: amount,
                    createdAt: DateTime.now(),
                  ),
                );
                _titleController.clear();
                _amountController.clear();
              },
              child: const Text('Save expense'),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Recent expenses', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (appState.recentExpenses.isEmpty)
            const _ExpenseTile(title: 'No expenses yet', amount: '—', subtitle: ''),
          ...appState.recentExpenses.map(
            (expense) => _ExpenseTile(
              title: expense.title,
              amount: '-${appState.formatCurrency(expense.amount)}',
              subtitle: 'Category: ${expense.category}',
            ),
          ),
        ],
      ),
    );
  }
}

class _ExpenseTile extends StatelessWidget {
  final String title;
  final String amount;
  final String subtitle;

  const _ExpenseTile({required this.title, required this.amount, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(vertical: 4),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: Text(amount, style: const TextStyle(fontWeight: FontWeight.w600)),
    );
  }
}

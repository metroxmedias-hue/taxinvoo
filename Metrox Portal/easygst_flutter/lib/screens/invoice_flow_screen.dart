import 'package:flutter/material.dart';

import '../models/app_state.dart';
import 'customer_detail_screen.dart';

class InvoiceFlowScreen extends StatefulWidget {
  const InvoiceFlowScreen({super.key});

  @override
  State<InvoiceFlowScreen> createState() => _InvoiceFlowScreenState();
}

class _InvoiceFlowScreenState extends State<InvoiceFlowScreen> {
  final _formKey = GlobalKey<FormState>();
  final _customer = TextEditingController();
  final _item = TextEditingController();
  final _amount = TextEditingController();
  String _type = 'gst';
  String _supply = 'intra';
  double _rate = 18;

  double _taxable = 0;
  double _cgst = 0;
  double _sgst = 0;
  double _igst = 0;
  double _total = 0;
  final TextEditingController _paymentController = TextEditingController();

  @override
  void dispose() {
    _customer.dispose();
    _item.dispose();
    _amount.dispose();
    _paymentController.dispose();
    super.dispose();
  }

  void _calculate() {
    final amount = double.tryParse(_amount.text) ?? 0;
    if (_type == 'non-gst' || _rate == 0) {
      setState(() {
        _taxable = amount;
        _cgst = 0;
        _sgst = 0;
        _igst = 0;
        _total = amount;
      });
      return;
    }
    final tax = amount * (_rate / 100);
    if (_supply == 'inter') {
      setState(() {
        _taxable = amount;
        _cgst = 0;
        _sgst = 0;
        _igst = tax;
        _total = amount + tax;
      });
      return;
    }
    final half = tax / 2;
    setState(() {
      _taxable = amount;
      _cgst = half;
      _sgst = half;
      _igst = 0;
      _total = amount + tax;
    });
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Create invoice', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          Form(
            key: _formKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _customer,
                  decoration: InputDecoration(
                    labelText: 'Customer name',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (value) => value == null || value.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _item,
                  decoration: InputDecoration(
                    labelText: 'Item / service',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (value) => value == null || value.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Taxable value (₹)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (value) => value == null || value.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _type,
                        items: const [
                          DropdownMenuItem(value: 'gst', child: Text('GST Invoice')),
                          DropdownMenuItem(value: 'non-gst', child: Text('Non-GST')),
                        ],
                        onChanged: (value) => setState(() => _type = value ?? 'gst'),
                        decoration: InputDecoration(
                          labelText: 'Invoice type',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _supply,
                        items: const [
                          DropdownMenuItem(value: 'intra', child: Text('Intra-state')),
                          DropdownMenuItem(value: 'inter', child: Text('Inter-state')),
                        ],
                        onChanged: (value) => setState(() => _supply = value ?? 'intra'),
                        decoration: InputDecoration(
                          labelText: 'Supply',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<double>(
                  value: _rate,
                  items: const [
                    DropdownMenuItem(value: 0, child: Text('0%')),
                    DropdownMenuItem(value: 5, child: Text('5%')),
                    DropdownMenuItem(value: 12, child: Text('12%')),
                    DropdownMenuItem(value: 18, child: Text('18%')),
                    DropdownMenuItem(value: 28, child: Text('28%')),
                  ],
                  onChanged: (value) => setState(() => _rate = value ?? 18),
                  decoration: InputDecoration(
                    labelText: 'GST slab',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      if (_formKey.currentState?.validate() ?? false) {
                        _calculate();
                        final invoice = Invoice(
                          id: appState.nextInvoiceId(),
                          customer: _customer.text.trim(),
                          item: _item.text.trim(),
                          type: _type == 'gst' ? InvoiceType.gst : InvoiceType.nonGst,
                          supply: _supply == 'inter' ? SupplyType.inter : SupplyType.intra,
                          rate: _rate,
                          taxable: _taxable,
                          cgst: _cgst,
                          sgst: _sgst,
                          igst: _igst,
                          total: _total,
                          createdAt: DateTime.now(),
                        );
                        appState.addInvoice(invoice);
                      }
                    },
                    child: const Text('Generate preview'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text('Invoice preview', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: Colors.white,
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                _PreviewRow(label: 'Customer', value: _customer.text.isEmpty ? '—' : _customer.text),
                _PreviewRow(label: 'Taxable value', value: appState.formatCurrency(_taxable, decimals: 2)),
                if (_type == 'non-gst' || _rate == 0)
                  _PreviewRow(label: 'GST', value: appState.formatCurrency(0, decimals: 2))
                else if (_supply == 'inter')
                  _PreviewRow(label: 'IGST', value: appState.formatCurrency(_igst, decimals: 2))
                else
                  Column(
                    children: [
                      _PreviewRow(label: 'CGST', value: appState.formatCurrency(_cgst, decimals: 2)),
                      _PreviewRow(label: 'SGST', value: appState.formatCurrency(_sgst, decimals: 2)),
                    ],
                  ),
                _PreviewRow(label: 'Total', value: appState.formatCurrency(_total, decimals: 2)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text('Invoices list', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          if (appState.invoices.isEmpty)
            const Text('No invoices yet.'),
          ...appState.invoices.reversed.map(
            (invoice) => _InvoiceTile(
              invoice: invoice,
              onRecordPayment: () => _showPaymentSheet(context, invoice, appState),
              onOpenCustomer: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => CustomerDetailScreen(customerName: invoice.customer),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showPaymentSheet(BuildContext context, Invoice invoice, AppState appState) {
    _paymentController.text = invoice.dueAmount.toStringAsFixed(2);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Record payment • ${invoice.id}', style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              Text('Due: ${appState.formatCurrency(invoice.dueAmount, decimals: 2)}'),
              const SizedBox(height: 12),
              TextField(
                controller: _paymentController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Payment amount (₹)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    final amount = double.tryParse(_paymentController.text) ?? 0;
                    appState.addPayment(invoice.id, amount);
                    Navigator.pop(context);
                  },
                  child: const Text('Save payment'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PreviewRow extends StatelessWidget {
  final String label;
  final String value;

  const _PreviewRow({required this.label, required this.value});

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

class _InvoiceTile extends StatelessWidget {
  final Invoice invoice;
  final VoidCallback onRecordPayment;
  final VoidCallback onOpenCustomer;

  const _InvoiceTile({
    required this.invoice,
    required this.onRecordPayment,
    required this.onOpenCustomer,
  });

  String get statusLabel => invoice.status.name.toUpperCase();

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${invoice.customer} • #${invoice.id}'),
                Chip(label: Text(statusLabel)),
              ],
            ),
            const SizedBox(height: 6),
            Text('Total: ₹${invoice.total.toStringAsFixed(2)}'),
            Text('Paid: ₹${invoice.paidAmount.toStringAsFixed(2)}'),
            Text('Due: ₹${invoice.dueAmount.toStringAsFixed(2)}'),
            const SizedBox(height: 8),
            Row(
              children: [
                TextButton(
                  onPressed: onRecordPayment,
                  child: const Text('Record payment'),
                ),
                TextButton(
                  onPressed: onOpenCustomer,
                  child: const Text('View customer'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum InvoiceType { gst, nonGst }

enum SupplyType { intra, inter }

enum InvoiceStatus { pending, partial, paid }

class CustomerSummary {
  final String name;
  final double totalBilled;
  final double totalPaid;

  CustomerSummary({
    required this.name,
    required this.totalBilled,
    required this.totalPaid,
  });

  double get due => (totalBilled - totalPaid).clamp(0, totalBilled);
}

class Payment {
  final String id;
  final String invoiceId;
  final double amount;
  final DateTime paidAt;

  Payment({
    required this.id,
    required this.invoiceId,
    required this.amount,
    required this.paidAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'invoiceId': invoiceId,
        'amount': amount,
        'paidAt': paidAt.toIso8601String(),
      };

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'] as String,
        invoiceId: json['invoiceId'] as String,
        amount: (json['amount'] as num).toDouble(),
        paidAt: DateTime.parse(json['paidAt'] as String),
      );
}

class Invoice {
  final String id;
  final String customer;
  final String item;
  final InvoiceType type;
  final SupplyType supply;
  final double rate;
  final double taxable;
  final double cgst;
  final double sgst;
  final double igst;
  final double total;
  final DateTime createdAt;
  InvoiceStatus status;
  double paidAmount;

  Invoice({
    required this.id,
    required this.customer,
    required this.item,
    required this.type,
    required this.supply,
    required this.rate,
    required this.taxable,
    required this.cgst,
    required this.sgst,
    required this.igst,
    required this.total,
    required this.createdAt,
    this.status = InvoiceStatus.pending,
    this.paidAmount = 0,
  });

  double get dueAmount => (total - paidAmount).clamp(0, total);

  Map<String, dynamic> toJson() => {
        'id': id,
        'customer': customer,
        'item': item,
        'type': type.name,
        'supply': supply.name,
        'rate': rate,
        'taxable': taxable,
        'cgst': cgst,
        'sgst': sgst,
        'igst': igst,
        'total': total,
        'createdAt': createdAt.toIso8601String(),
        'status': status.name,
        'paidAmount': paidAmount,
      };

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
        id: json['id'] as String,
        customer: json['customer'] as String,
        item: json['item'] as String,
        type: InvoiceType.values.firstWhere((e) => e.name == json['type']),
        supply: SupplyType.values.firstWhere((e) => e.name == json['supply']),
        rate: (json['rate'] as num).toDouble(),
        taxable: (json['taxable'] as num).toDouble(),
        cgst: (json['cgst'] as num).toDouble(),
        sgst: (json['sgst'] as num).toDouble(),
        igst: (json['igst'] as num).toDouble(),
        total: (json['total'] as num).toDouble(),
        createdAt: DateTime.parse(json['createdAt'] as String),
        status: InvoiceStatus.values.firstWhere((e) => e.name == json['status']),
        paidAmount: (json['paidAmount'] as num).toDouble(),
      );
}

class Expense {
  final String id;
  final String title;
  final String category;
  final double amount;
  final DateTime createdAt;

  Expense({
    required this.id,
    required this.title,
    required this.category,
    required this.amount,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'category': category,
        'amount': amount,
        'createdAt': createdAt.toIso8601String(),
      };

  factory Expense.fromJson(Map<String, dynamic> json) => Expense(
        id: json['id'] as String,
        title: json['title'] as String,
        category: json['category'] as String,
        amount: (json['amount'] as num).toDouble(),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class AppState extends ChangeNotifier {
  final List<Invoice> _invoices = [];
  final List<Expense> _expenses = [];
  final List<Payment> _payments = [];
  int _invoiceCounter = 2409;
  int _expenseCounter = 110;
  int _paymentCounter = 900;
  bool _loaded = false;

  List<Invoice> get invoices => List.unmodifiable(_invoices);
  List<Expense> get expenses => List.unmodifiable(_expenses);
  List<Payment> get payments => List.unmodifiable(_payments);
  bool get isLoaded => _loaded;

  String nextInvoiceId() {
    _invoiceCounter += 1;
    return 'EG-$_invoiceCounter';
  }

  String nextExpenseId() {
    _expenseCounter += 1;
    return 'EX-$_expenseCounter';
  }

  String nextPaymentId() {
    _paymentCounter += 1;
    return 'PM-$_paymentCounter';
  }

  void addInvoice(Invoice invoice) {
    _invoices.add(invoice);
    _persist();
    notifyListeners();
  }

  void addExpense(Expense expense) {
    _expenses.add(expense);
    _persist();
    notifyListeners();
  }

  void addPayment(String invoiceId, double amount) {
    final invoice = _invoices.firstWhere((inv) => inv.id == invoiceId);
    final paymentAmount = amount.clamp(0, invoice.dueAmount);
    if (paymentAmount <= 0) return;
    invoice.paidAmount += paymentAmount;
    if (invoice.paidAmount >= invoice.total) {
      invoice.status = InvoiceStatus.paid;
    } else if (invoice.paidAmount > 0) {
      invoice.status = InvoiceStatus.partial;
    }
    _payments.add(
      Payment(
        id: nextPaymentId(),
        invoiceId: invoiceId,
        amount: paymentAmount,
        paidAt: DateTime.now(),
      ),
    );
    _persist();
    notifyListeners();
  }

  double get totalSales => _invoices.fold(0, (sum, inv) => sum + inv.total);

  double get gstPayable => _invoices.fold(0, (sum, inv) => sum + inv.cgst + inv.sgst + inv.igst);

  double get totalPaid => _invoices.fold(0, (sum, inv) => sum + inv.paidAmount);

  double get totalExpenses => _expenses.fold(0, (sum, exp) => sum + exp.amount);

  double get profit => totalSales - totalExpenses;

  List<Invoice> get recentInvoices => _invoices.reversed.take(3).toList();

  List<Expense> get recentExpenses => _expenses.reversed.take(3).toList();

  List<CustomerSummary> get customers {
    final Map<String, CustomerSummary> summaries = {};
    for (final invoice in _invoices) {
      final existing = summaries[invoice.customer];
      if (existing == null) {
        summaries[invoice.customer] = CustomerSummary(
          name: invoice.customer,
          totalBilled: invoice.total,
          totalPaid: invoice.paidAmount,
        );
      } else {
        summaries[invoice.customer] = CustomerSummary(
          name: invoice.customer,
          totalBilled: existing.totalBilled + invoice.total,
          totalPaid: existing.totalPaid + invoice.paidAmount,
        );
      }
    }
    return summaries.values.toList()
      ..sort((a, b) => b.totalBilled.compareTo(a.totalBilled));
  }

  List<Invoice> invoicesForCustomer(String customer) {
    return _invoices.where((inv) => inv.customer == customer).toList();
  }

  String formatCurrency(num value, {int decimals = 0}) {
    final formatter = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: decimals);
    return formatter.format(value);
  }

  Future<void> loadFromStorage() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('Metrox TaxInvoo_state');
    if (raw == null) {
      _loaded = true;
      notifyListeners();
      return;
    }
    final data = jsonDecode(raw) as Map<String, dynamic>;
    _invoiceCounter = data['invoiceCounter'] as int? ?? _invoiceCounter;
    _expenseCounter = data['expenseCounter'] as int? ?? _expenseCounter;
    _paymentCounter = data['paymentCounter'] as int? ?? _paymentCounter;
    final invoices = (data['invoices'] as List<dynamic>? ?? [])
        .map((item) => Invoice.fromJson(item as Map<String, dynamic>))
        .toList();
    final expenses = (data['expenses'] as List<dynamic>? ?? [])
        .map((item) => Expense.fromJson(item as Map<String, dynamic>))
        .toList();
    final payments = (data['payments'] as List<dynamic>? ?? [])
        .map((item) => Payment.fromJson(item as Map<String, dynamic>))
        .toList();
    _invoices
      ..clear()
      ..addAll(invoices);
    _expenses
      ..clear()
      ..addAll(expenses);
    _payments
      ..clear()
      ..addAll(payments);
    _loaded = true;
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    final payload = jsonEncode({
      'invoiceCounter': _invoiceCounter,
      'expenseCounter': _expenseCounter,
      'paymentCounter': _paymentCounter,
      'invoices': _invoices.map((inv) => inv.toJson()).toList(),
      'expenses': _expenses.map((exp) => exp.toJson()).toList(),
      'payments': _payments.map((pay) => pay.toJson()).toList(),
    });
    await prefs.setString('Metrox TaxInvoo_state', payload);
  }
}

class AppStateScope extends InheritedNotifier<AppState> {
  const AppStateScope({
    super.key,
    required AppState notifier,
    required Widget child,
  }) : super(notifier: notifier, child: child);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppStateScope>();
    assert(scope != null, 'AppStateScope not found in widget tree');
    return scope!.notifier!;
  }
}

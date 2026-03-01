import 'package:flutter/material.dart';

import 'models/app_state.dart';
import 'screens/dashboard_screen.dart';
import 'screens/expenses_screen.dart';
import 'screens/invoice_flow_screen.dart';
import 'screens/ledger_screen.dart';
import 'screens/customer_list_screen.dart';
import 'screens/login_screen.dart';
import 'screens/profile_setup_screen.dart';
import 'screens/reports_screen.dart';

void main() {
  runApp(const Metrox TaxInvooApp());
}

class Metrox TaxInvooApp extends StatefulWidget {
  const Metrox TaxInvooApp({super.key});

  @override
  State<Metrox TaxInvooApp> createState() => _Metrox TaxInvooAppState();
}

class _Metrox TaxInvooAppState extends State<Metrox TaxInvooApp> {
  final AppState _state = AppState();

  @override
  void initState() {
    super.initState();
    _state.loadFromStorage();
  }

  @override
  Widget build(BuildContext context) {
    return AppStateScope(
      notifier: _state,
      child: MaterialApp(
        title: 'Metrox TaxInvoo',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFFF7B23B),
            brightness: Brightness.light,
          ),
          useMaterial3: true,
        ),
        home: const OnboardingShell(),
      ),
    );
  }
}

class OnboardingShell extends StatefulWidget {
  const OnboardingShell({super.key});

  @override
  State<OnboardingShell> createState() => _OnboardingShellState();
}

class _OnboardingShellState extends State<OnboardingShell> {
  int step = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      LoginScreen(onContinue: () => setState(() => step = 1)),
      ProfileSetupScreen(onFinish: () => setState(() => step = 2)),
      const MainShell(),
    ];

    return pages[step];
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = <Widget>[
      const DashboardScreen(),
      const InvoiceFlowScreen(),
      const CustomerListScreen(),
      const LedgerScreen(),
      const ReportsScreen(),
      const ExpensesScreen(),
    ];

    return Scaffold(
      body: screens[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.receipt_long), label: 'Bills'),
          NavigationDestination(icon: Icon(Icons.people_alt_outlined), label: 'Customers'),
          NavigationDestination(icon: Icon(Icons.book_outlined), label: 'Ledger'),
          NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Reports'),
          NavigationDestination(icon: Icon(Icons.payments), label: 'Expenses'),
        ],
      ),
    );
  }
}

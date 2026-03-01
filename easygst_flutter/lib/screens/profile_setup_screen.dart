import 'package:flutter/material.dart';

class ProfileSetupScreen extends StatelessWidget {
  final VoidCallback onFinish;

  const ProfileSetupScreen({super.key, required this.onFinish});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Business setup')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text(
              'Tell us about your business',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: InputDecoration(
                labelText: 'Business name',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: InputDecoration(
                labelText: 'GSTIN (optional)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              items: const [
                DropdownMenuItem(value: 'goods', child: Text('Goods')),
                DropdownMenuItem(value: 'services', child: Text('Services')),
              ],
              onChanged: (_) {},
              decoration: InputDecoration(
                labelText: 'Business type',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              items: const [
                DropdownMenuItem(value: '0', child: Text('0%')),
                DropdownMenuItem(value: '5', child: Text('5%')),
                DropdownMenuItem(value: '12', child: Text('12%')),
                DropdownMenuItem(value: '18', child: Text('18%')),
                DropdownMenuItem(value: '28', child: Text('28%')),
              ],
              onChanged: (_) {},
              decoration: InputDecoration(
                labelText: 'Default GST slab',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onFinish,
                child: const Text('Save & Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

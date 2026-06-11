const PLAN_ACCESS = {
  starter: ['dashboard', 'invoices', 'clients'],
  growth: ['dashboard', 'invoices', 'clients', 'reports'],
  pro: ['all']
};

const KNOWN_PLANS = new Set(['starter', 'growth', 'pro', 'basic', 'premium', 'trial']);

const FEATURE_ALIASES = {
  dashboard: 'dashboard',
  invoices: 'invoices',
  invoice: 'invoices',
  basic_invoice: 'invoices',
  unlimited_invoice: 'unlimited_invoice',
  clients: 'clients',
  client: 'clients',
  client_management: 'clients',
  reports: 'reports',
  gst_reports: 'reports',
  reminders: 'reminders',
  analytics: 'advanced_analytics',
  advanced_analytics: 'advanced_analytics',
  advanced_reports: 'advanced_reports',
  audit_logs: 'audit_logs',
  multi_user: 'multi_user',
  team_access: 'multi_user',
  export_reports: 'export_reports',
  advanced_export: 'export_reports',
  advanced_exports: 'export_reports'
};

const GROWTH_PLUS_FEATURES = new Set(['unlimited_invoice', 'reminders']);
const PRO_ONLY_FEATURES = new Set([
  'advanced_analytics',
  'advanced_reports',
  'audit_logs',
  'multi_user',
  'export_reports'
]);

function isKnownPlan(value) {
  return KNOWN_PLANS.has(String(value || '').trim().toLowerCase());
}

function normalizeFeature(feature) {
  const raw = String(feature || '').trim().toLowerCase();
  return FEATURE_ALIASES[raw] || raw;
}

export function normalizePlan(plan) {
  const raw = String(plan || '').trim().toLowerCase();
  if (raw === 'basic') return 'starter';
  if (raw === 'premium') return 'pro';
  if (raw === 'trial') return 'growth';
  if (raw === 'starter' || raw === 'growth' || raw === 'pro') return raw;
  return 'starter';
}

export function hasAccess(arg1, arg2) {
  const first = String(arg1 || '').trim().toLowerCase();
  const second = String(arg2 || '').trim().toLowerCase();
  const firstIsPlan = isKnownPlan(first);
  const secondIsPlan = isKnownPlan(second);

  const planInput = (!firstIsPlan && secondIsPlan) ? arg2 : arg1;
  const featureInput = (!firstIsPlan && secondIsPlan) ? arg1 : arg2;

  const planKey = normalizePlan(planInput);
  const featureKey = normalizeFeature(featureInput);
  const allowed = PLAN_ACCESS[planKey] || PLAN_ACCESS.starter;

  if (allowed.includes('all')) return true;
  if (!featureKey) return false;
  if (GROWTH_PLUS_FEATURES.has(featureKey)) return planKey === 'growth' || planKey === 'pro';
  if (PRO_ONLY_FEATURES.has(featureKey)) return planKey === 'pro';

  return allowed.includes(featureKey);
}

export function canAccessReports(plan) {
  return hasAccess(plan, 'reports');
}

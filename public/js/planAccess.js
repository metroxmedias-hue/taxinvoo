const PLAN_ACCESS = {
  starter: new Set([
    'basic_invoice',
    'client_management'
  ]),
  growth: new Set([
    'basic_invoice',
    'client_management',
    'unlimited_invoice',
    'reports',
    'reminders'
  ]),
  pro: new Set([
    'basic_invoice',
    'client_management',
    'unlimited_invoice',
    'reports',
    'reminders',
    'analytics',
    'multi_user'
  ])
};

export function normalizePlan(plan) {
  const raw = String(plan || '').trim().toLowerCase();
  if (raw === 'basic') return 'starter';
  if (raw === 'premium') return 'pro';
  if (raw === 'trial') return 'growth';
  if (raw === 'starter' || raw === 'growth' || raw === 'pro') return raw;
  return 'starter';
}

export function hasAccess(plan, feature) {
  const planKey = normalizePlan(plan);
  const featureKey = String(feature || '').trim().toLowerCase();
  const allowed = PLAN_ACCESS[planKey] || PLAN_ACCESS.starter;
  return allowed.has(featureKey);
}

export function canAccessReports(plan) {
  return hasAccess(plan, 'reports');
}

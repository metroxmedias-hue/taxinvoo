import { db } from '../config/firebase.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nextStatus(subscription, now = new Date()) {
  if (!subscription || subscription.is_paid === true) return 'active';

  const plan = String(subscription.plan || '').toLowerCase();
  if (plan !== 'trial') return String(subscription.status || 'active').toLowerCase();

  const trialEnd = toDate(subscription.trial_ends_at);
  if (!trialEnd) return String(subscription.status || 'active').toLowerCase();
  if (now <= trialEnd) return 'active';

  const graceEnd = new Date(trialEnd.getTime() + DAY_MS);
  if (now <= graceEnd) return 'grace';
  return 'expired';
}

export async function runSubscriptionExpiryJob({ dryRun = false } = {}) {
  const now = new Date();
  const snap = await db.collection('subscriptions').get();

  let scanned = 0;
  let updated = 0;
  let grace = 0;
  let expired = 0;

  for (const row of snap.docs) {
    scanned += 1;
    const data = row.data() || {};
    const current = String(data.status || '').toLowerCase();
    const next = nextStatus(data, now);
    if (current === next) continue;

    if (!dryRun) {
      await row.ref.set(
        {
          status: next,
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
    }

    updated += 1;
    if (next === 'grace') grace += 1;
    if (next === 'expired') expired += 1;
  }

  return { scanned, updated, grace, expired, dryRun, at: now.toISOString() };
}

async function main() {
  try {
    const dryRun = process.argv.includes('--dry-run');
    const result = await runSubscriptionExpiryJob({ dryRun });
    console.log('[subscription-expiry-job] done', result);
    process.exit(0);
  } catch (error) {
    console.error('[subscription-expiry-job] failed', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

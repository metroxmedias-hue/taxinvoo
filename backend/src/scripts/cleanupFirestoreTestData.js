import { db } from '../config/firebase.js';

function parseArgs(argv) {
  const args = { keepUid: '', dryRun: false };
  for (const item of argv) {
    if (item === '--dry-run') args.dryRun = true;
    if (item.startsWith('--keep-uid=')) args.keepUid = item.split('=')[1] || '';
  }
  return args;
}

async function deleteAllDocsInCollection(collectionRef, { dryRun, label }) {
  const snap = await collectionRef.get();
  if (snap.empty) {
    console.log(`[cleanup] ${label}: nothing to delete`);
    return 0;
  }
  let deleted = 0;
  for (const row of snap.docs) {
    if (dryRun) {
      console.log(`[dry-run] delete doc ${row.ref.path}`);
      deleted += 1;
      continue;
    }
    await db.recursiveDelete(row.ref);
    deleted += 1;
  }
  console.log(`[cleanup] ${label}: removed ${deleted} docs`);
  return deleted;
}

async function deleteLegacyTopLevelCollections({ dryRun }) {
  const collections = ['businesses', 'invoices', 'payments', 'ledger'];
  for (const name of collections) {
    await deleteAllDocsInCollection(db.collection(name), { dryRun, label: `legacy/${name}` });
  }
}

async function cleanupUsers({ keepUid, dryRun }) {
  const usersSnap = await db.collection('users').get();
  let kept = false;
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    if (uid === keepUid) {
      kept = true;
      const businessesRef = userDoc.ref.collection('businesses');
      await deleteAllDocsInCollection(businessesRef, { dryRun, label: `users/${uid}/businesses` });
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] delete user tree ${userDoc.ref.path}`);
      continue;
    }
    await db.recursiveDelete(userDoc.ref);
    console.log(`[cleanup] deleted user tree ${userDoc.ref.path}`);
  }

  if (!kept) {
    console.warn(`[cleanup] keep UID not found in /users: ${keepUid}`);
  }
}

async function main() {
  const { keepUid, dryRun } = parseArgs(process.argv.slice(2));
  if (!keepUid) {
    throw new Error('Missing required argument: --keep-uid=<FIREBASE_UID>');
  }

  console.log(`[cleanup] starting firestore cleanup. keepUid=${keepUid} dryRun=${dryRun}`);

  await deleteLegacyTopLevelCollections({ dryRun });
  await cleanupUsers({ keepUid, dryRun });

  console.log('[cleanup] done');
}

main().catch((err) => {
  console.error('[cleanup] failed:', err?.message || err);
  process.exit(1);
});

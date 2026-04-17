# Firebase Rules Setup for TaxInvoo Blog CMS

Your error `Missing or insufficient permissions` means Firestore/Storage rules are blocking reads/writes.

## 1) Firestore Rules (blogs collection)
Use this for **quick testing**:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /blogs/{blogId} {
      allow read, write: if true;
    }
  }
}
```

Use this for **production (authenticated users only)**:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /blogs/{blogId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 2) Storage Rules (thumbnail upload)
Use this for **quick testing**:

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /blogs/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

Use this for **production (authenticated users only)**:

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /blogs/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 3) Important project checks
- Firebase project id in code: `metrox-taxinvo`
- Ensure your app is connected to the same Firebase project in Console.
- Ensure Storage is enabled in Firebase Console.
- If using authenticated rules, sign in users before publishing/editing/deleting.

## 4) Why publish failed
- Blog publish = Firestore write to `/blogs`.
- Thumbnail upload = Storage write to `/blogs/...`.
- Manage table load = Firestore read from `/blogs`.

If rules deny these, you get exactly the errors shown in your screenshot.

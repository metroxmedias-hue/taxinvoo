import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5vhi43CcL_ff_NZLIN3BUxa0CAYOvwh8",
  authDomain: "metrox-taxinvo.firebaseapp.com",
  projectId: "metrox-taxinvo",
  storageBucket: "metrox-taxinvo.firebasestorage.app",
  messagingSenderId: "1089587049670",
  appId: "1:1089587049670:web:4f3b663c767762749853c7",
  measurementId: "G-8JVQCSZX0P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

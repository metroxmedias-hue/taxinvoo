import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5vhi43CcL_ff_NZLIN3BUxa0CAYOvwh8",
  authDomain: "metrox-taxinvo.firebaseapp.com",
  projectId: "metrox-taxinvo",
  storageBucket: "metrox-taxinvo.firebasestorage.app",
  messagingSenderId: "1089587049670",
  appId: "1:1089587049670:web:4f3b663c767762749853c7",
  measurementId: "G-8JVQCSZX0P"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const DASHBOARD_URL = "/app/index.html#/dashboard";

const loginButtons = [
  document.getElementById("googleLoginBtn"),
  document.getElementById("google-signup")
].filter(Boolean);

loginButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
      window.location.replace(DASHBOARD_URL);
    } catch (error) {
      console.error("Google login error:", error);
      alert("Login failed");
    }
  });
});

onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.includes("login")) {
    window.location.replace(DASHBOARD_URL);
  }
});

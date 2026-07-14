// ============================================================
// FIREBASE CONFIG — your project's keys (safe to be public,
// Firestore Security Rules are what actually protect your data)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDWuWvG3o0m67T_ec0jTwlPxp_7WxiKiK8",
  authDomain: "pscfutureu.firebaseapp.com",
  projectId: "pscfutureu",
  storageBucket: "pscfutureu.firebasestorage.app",
  messagingSenderId: "807475817443",
  appId: "1:807475817443:web:713a61cd44fe7c39320ed6",
  measurementId: "G-11CWH58QB7"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// The ONLY email allowed into the admin panel.
const ADMIN_EMAIL = "futureuapp@gmail.com";

// The 14 districts of Kerala, used on the profile-completion form.
const KERALA_DISTRICTS = [
  "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha",
  "Kottayam", "Idukki", "Ernakulam", "Thrissur", "Palakkad",
  "Malappuram", "Kozhikode", "Wayanad", "Kannur", "Kasaragod"
];

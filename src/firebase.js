// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDU_m1DBGvaJZcgwLsSTqe3oTiF4xevGvQ",
  authDomain: "aquacheck-2bff3.firebaseapp.com",
  databaseURL: "https://aquacheck-2bff3-default-rtdb.firebaseio.com",
  projectId: "aquacheck-2bff3",
  storageBucket: "aquacheck-2bff3.appspot.com",
  messagingSenderId: "1034414018550",
  appId: "1:1034414018550:web:09ee57d7780c09d87841d7",
  measurementId: "G-EQ0HB782R6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const database = getDatabase(app);
export const functions = getFunctions(app);

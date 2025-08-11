import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const functions = getFunctions(app);

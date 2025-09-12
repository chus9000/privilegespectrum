// Firebase configuration
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "privilegespectrum.firebaseapp.com",
  projectId: "privilegespectrum",
  storageBucket: "privilegespectrum.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

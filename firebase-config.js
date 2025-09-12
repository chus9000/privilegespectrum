// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBoHjADjt_IILbbbr1PbHHvxZ4KKXYQc7Y",
  authDomain: "privilegespectrum.firebaseapp.com",
  projectId: "privilegespectrum",
  storageBucket: "privilegespectrum.firebasestorage.app",
  messagingSenderId: "39262599514",
  appId: "1:39262599514:web:8ac4f733ed36e700319b63",
};

// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

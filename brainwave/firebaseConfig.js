import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
// import {...} from 'firebase/database';
// import {...} from 'firebase/firestore';
// import {...} from 'firebase/functions';
// import {...} from 'firebase/storage';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCgEHSReWyqTdqWJDkfSSJxAk7nUXBgUxI",
  authDomain: "brainwave-abe57.firebaseapp.com",
  projectId: "brainwave-abe57",
  storageBucket: "brainwave-abe57.firebasestorage.app",
  messagingSenderId: "1012156637414",
  appId: "1:1012156637414:web:b9c035b47113d8f9a65b27",
  measurementId: "G-8FVSVLGM03",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
// For more information on how to access Firebase in your project,
// see the Firebase documentation: https://firebase.google.com/docs/web/setup#access-firebase

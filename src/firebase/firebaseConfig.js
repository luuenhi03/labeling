// Import các chức năng cần thiết từ Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getStorage,
  ref,
  listAll,
  getDownloadURL,
  deleteObject,
  uploadBytes,
} from "firebase/storage";
import { getAuth } from "firebase/auth";
// import { getAnalytics } from "firebase/analytics"; // Nếu cần sử dụng Analytics

// Cấu hình Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAqpKF2zdQiZcuSOZWRiXtqYmzQQVOMZ34",
  authDomain: "image-label-2d36f.firebaseapp.com",
  databaseURL:
    "https://image-label-2d36f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "image-label-2d36f",
  storageBucket: "image-label-2d36f.firebasestorage.app",
  messagingSenderId: "651020465561",
  appId: "1:651020465561:web:81d49c4d1a5ca3b91d0f08",
  measurementId: "G-4CG9Q1FVHL",
};

const firebaseApp = initializeApp(firebaseConfig);
const imageDb = getStorage(firebaseApp); // Firebase Storage
const firestoreDb = getFirestore(firebaseApp); // Firestore

const auth = getAuth(firebaseApp);

export {
  firestoreDb,
  firebaseApp,
  imageDb,
  ref,
  listAll,
  getDownloadURL,
  deleteObject,
  uploadBytes,
  auth,
};

// firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getAnalytics, type Analytics, isSupported as analyticsIsSupported } from "firebase/analytics"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"

// All config values pulled from env. Public ones must be prefixed with NEXT_PUBLIC_
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Singleton pattern (avoid re-init during HMR)
let app: FirebaseApp
if (!getApps().length) {
    app = initializeApp(firebaseConfig)
} else {
    app = getApps()[0]!
}

// Services
const auth: Auth = getAuth(app)
const db: Firestore = getFirestore(app)
const storage: FirebaseStorage = getStorage(app)

// Analytics only in browser & supported
let analytics: Analytics | undefined
if (typeof window !== "undefined") {
    analyticsIsSupported().then((ok) => {
        if (ok) analytics = getAnalytics(app)
    })
}

export { app, auth, db, storage, analytics }
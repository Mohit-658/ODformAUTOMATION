import { auth } from "@/firebase"
import { signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth"

/** Ensure there's a signed-in user (anonymous) so Firestore rules requiring auth pass. */
export async function ensureAuth() {
    if (!auth.currentUser) {
        await signInAnonymously(auth)
    }
    return auth.currentUser
}

export async function signInCoordinator(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
}

export async function signOutUser() {
    await signOut(auth)
}

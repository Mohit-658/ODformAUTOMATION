"use client"
import { useState, useEffect } from "react"
import { signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth"
import Image from "next/image"
import { auth } from "@/firebase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const COORDINATOR_EMAIL = "amitycodingclub@gmail.com"

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user?.email === COORDINATOR_EMAIL) {
                router.replace("/")
            }
        })
        return () => unsub()
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password)
            if (cred.user.email !== COORDINATOR_EMAIL) {
                setError("Not authorized as coordinator")
                return
            }
            router.replace("/")
        } catch (err: any) {
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                setError('Invalid credentials')
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email format')
            } else if (err.code === 'auth/operation-not-allowed') {
                setError('Email/Password provider is disabled in Firebase Console')
            } else {
                setError(err.message || 'Login failed')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <Card className="w-full max-w-md p-8 space-y-6 bg-white">
                <div className="text-center space-y-3">
                    {/* Logo: using Next/Image for proper intrinsic sizing & crisp scaling */}
                    <div className="mx-auto w-28 h-24 relative">
                        <Image
                            src="/images/image.png"
                            alt="ACConduty Logo"
                            fill
                            priority
                            className="object-contain"
                            sizes="112px"
                        />
                    </div>
                    <h1 className="text-2xl font-grandiflora">Coordinator Login</h1>
                    <p className="text-sm text-gray-500">Restricted access</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="email" className="mb-1 block">Email</Label>
                        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div>
                        <Label htmlFor="password" className="mb-1 block">Password</Label>
                        <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <p className="text-xs text-gray-400">Ensure Email/Password sign-in is enabled in Firebase Auth.</p>
                    <Button type="submit" disabled={loading} className="w-full rounded-full bg-black text-white hover:bg-black/90 font-jura">
                        {loading ? 'Signing in...' : 'Login'}
                    </Button>
                </form>
                <p className="text-xs text-gray-400 text-center">Enter assigned coordinator credentials. No autofill for security.</p>
            </Card>
        </div>
    )
}

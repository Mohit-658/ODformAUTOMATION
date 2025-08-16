"use client"
import { useState, useEffect } from "react"
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth"
import Image from "next/image"
import { auth } from "@/firebase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, AlertTriangle } from "lucide-react"

const COORDINATOR_EMAIL = "amitycodingclub@gmail.com"

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [capsLock, setCapsLock] = useState(false)

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
        <div className="min-h-screen relative flex items-center justify-center bg-gray-100 p-4 overflow-hidden">
            <Card className="w-full max-w-md p-8 md:p-10 space-y-7 bg-white/85 backdrop-blur-xl border border-white/40 shadow-xl relative z-10 rounded-3xl">
                <div className="text-center space-y-4">
                    <div className="mx-auto w-28 h-24 relative">
                        <Image src="/images/image.png" alt="ACConduty Logo" fill priority className="object-contain" sizes="112px" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl md:text-3xl font-grandiflora tracking-wide">Coordinator Login</h1>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Restricted Access</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-medium tracking-wide">Email</Label>
                        <Input id="email" type="email" autoComplete="off" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} required className="bg-teal-50/40 focus-visible:ring-teal-500" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-xs font-medium tracking-wide">Password</Label>
                        <div className="relative group">
                            <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onKeyUp={e => setCapsLock((e as any).getModifierState && (e as any).getModifierState('CapsLock'))} onKeyDown={e => setCapsLock((e as any).getModifierState && (e as any).getModifierState('CapsLock'))} required className="pr-10 bg-teal-50/40 focus-visible:ring-teal-500" aria-describedby={capsLock ? 'caps-lock-warning' : undefined} />
                            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(p => !p)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-teal-600">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {capsLock && (
                            <div id="caps-lock-warning" className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                                <AlertTriangle className="w-3 h-3" /> CAPS LOCK is on
                            </div>
                        )}
                    </div>
                    {error && <div role="alert" aria-live="assertive" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
                    {!error && email && password && !loading && (
                        <p className="text-[10px] text-teal-700 flex items-center gap-1">Press Enter to login</p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>Use assigned credentials only.</span>
                        <span className="italic">Secure Area</span>
                    </div>
                    <Button type="submit" disabled={loading || !email || !password} className="w-full rounded-full bg-black text-white hover:bg-black/90 font-jura h-11 text-sm relative disabled:opacity-60 disabled:cursor-not-allowed">
                        {loading && <span className="absolute left-4 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                        {loading ? 'Signing in...' : 'Login'}
                    </Button>
                </form>
                <p className="text-[10px] text-gray-500 text-center leading-relaxed">Email/Password sign-in must be enabled in Firebase. Autofill disabled intentionally.</p>
            </Card>
        </div>
    )
}

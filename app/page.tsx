"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/firebase"
import { ArrowRight, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Typewriter } from "@/components/typewriter"
// Form components now live on dedicated routes (/single, /multiple)
import { signOutUser } from "@/lib/auth"

const COORDINATOR_EMAIL = "amitycodingclub@gmail.com"

export default function ODFormPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  // Form / selection UI state hooks must be declared unconditionally (before any returns)
  const [selectedOption, setSelectedOption] = useState<"single" | "multiple">("single")
  const [showSecondText, setShowSecondText] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email === COORDINATOR_EMAIL) {
        setAuthorized(true)
      } else {
        setAuthorized(false)
      }
      setAuthChecked(true)
      if (!user || user.email !== COORDINATOR_EMAIL) {
        router.replace("/login")
      }
    })
    return () => unsub()
  }, [router])

  if (!authChecked || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 font-jura">Checking access...</p>
      </div>
    )
  }

  const handleArrowClick = () => {
    if (selectedOption === 'single') router.push('/single')
    else router.push('/multiple')
  }

  const handleLogout = async () => {
    try {
      await signOutUser()
      router.replace("/login")
    } catch (e) {
      console.error("Failed to sign out", e)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 relative overflow-hidden">
      {/* Header with Logo */}
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/images/acc-logo.png" alt="Amity Coding Club Logo" className="w-20 h-20 object-contain" />
        </div>
        <Button
          className="font-jura flex items-center gap-2 rounded-full bg-black text-white hover:bg-black/90 shadow"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" /> Logout
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-8 pt-16">
        <div className="text-left mb-12">
          <h2 className="text-4xl font-grandiflora text-black mb-4">
            <Typewriter
              text="Hi there!"
              speed={150}
              delay={500}
              loop={true}
              pauseDuration={3000}
              onComplete={() => setShowSecondText(true)}
            />
          </h2>
          <p className="text-3xl font-grandiflora text-black">
            {showSecondText && (
              <Typewriter
                text="Ready to submit your OD form?"
                speed={80}
                delay={200}
                loop={true}
                pauseDuration={3000}
              />
            )}
          </p>
        </div>

        {/* Selection Card */}
        <Card className="w-full max-w-md p-6 shadow-lg bg-[rgba(255,255,255,1)] rounded-4xl">
          <p className="text-gray-500 text-sm mb-4">Choose one...</p>

          <div className="flex items-center gap-4">
            <div className="flex gap-2 flex-1">
              <Button
                variant={selectedOption === "single" ? "default" : "outline"}
                className={`flex-1 rounded-full py-3 font-jura ${selectedOption === "single"
                  ? "bg-black text-white hover:bg-black/90"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                onClick={() => setSelectedOption("single")}
              >
                {"Manual"}
              </Button>

              <Button
                variant={selectedOption === "multiple" ? "default" : "outline"}
                className={`flex-1 rounded-full py-3 font-jura ${selectedOption === "multiple"
                  ? "bg-teal-600 text-white hover:bg-teal-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                onClick={() => setSelectedOption("multiple")}
              >
                Multiple
              </Button>
            </div>

            <Button
              size="icon"
              className="rounded-full bg-black text-white hover:bg-black/90 w-12 h-12"
              onClick={handleArrowClick}
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Decorative Wave (mobile widened) */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden">
        <svg
          viewBox="0 0 1440 320"
          className="h-auto w-[160%] -ml-[30%] sm:ml-0 sm:w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="#14b8a6"
            fillOpacity="1"
            d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,149.3C672,149,768,203,864,208C960,213,1056,171,1152,149.3C1248,128,1344,128,1392,128L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>
    </div>
  )
}

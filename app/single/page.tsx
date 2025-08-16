"use client"
import { ODForm } from "@/components/od-form"
import { useRouter } from "next/navigation"

export default function SinglePage(){
  const router = useRouter()
  return <ODForm onBack={() => router.push('/')} />
}

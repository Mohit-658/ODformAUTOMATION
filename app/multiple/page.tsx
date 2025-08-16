"use client"
import { MultipleEntry } from "@/components/multiple-entry"
import { useRouter } from "next/navigation"

export default function MultiplePage(){
  const router = useRouter()
  return <MultipleEntry onBack={() => router.push('/')} />
}

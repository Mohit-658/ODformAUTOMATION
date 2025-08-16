import type React from "react"
import type { Metadata } from "next"
import { Inter, Grandiflora_One, Jura } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })
const grandiflora = Grandiflora_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-grandiflora",
})
const jura = Jura({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jura",
})

export const metadata: Metadata = {
  title: "ACConduty",
  description: "ACConduty - OD form automation",
  generator: 'v0.app',
  icons: {
    icon: "/images/image.png",
    shortcut: "/images/image.png",
    apple: "/images/image.png"
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.className} ${grandiflora.variable} ${jura.variable}`}>
      <body>{children}</body>
    </html>
  )
}

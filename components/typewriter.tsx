"use client"

import { useState, useEffect } from "react"

interface TypewriterProps {
  text: string
  speed?: number
  delay?: number
  className?: string
  onComplete?: () => void
  loop?: boolean
  pauseDuration?: number
}

export function Typewriter({
  text,
  speed = 100,
  delay = 0,
  className = "",
  onComplete,
  loop = false,
  pauseDuration = 2000,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isStarted, setIsStarted] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [hasCalledOnComplete, setHasCalledOnComplete] = useState(false)
  const [cycleCount, setCycleCount] = useState(0)

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setIsStarted(true)
    }, delay)

    return () => clearTimeout(startTimer)
  }, [delay, cycleCount]) // Added cycleCount dependency

  useEffect(() => {
    if (!isStarted) return

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed)

      return () => clearTimeout(timer)
    } else if (!isComplete) {
      setIsComplete(true)

      if (onComplete && !hasCalledOnComplete) {
        onComplete()
        setHasCalledOnComplete(true)
      }

      if (loop) {
        const resetTimer = setTimeout(() => {
          setDisplayText("")
          setCurrentIndex(0)
          setIsComplete(false)
          setIsStarted(false)
          setCycleCount((prev) => prev + 1)
        }, pauseDuration)

        return () => clearTimeout(resetTimer)
      }
    }
  }, [
    currentIndex,
    text,
    speed,
    isStarted,
    onComplete,
    isComplete,
    loop,
    pauseDuration,
    hasCalledOnComplete,
    cycleCount,
  ]) // Added cycleCount dependency

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  )
}

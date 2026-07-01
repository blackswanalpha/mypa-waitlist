"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface MyPALogoProps {
  className?: string
  showText?: boolean
}

export function MyPALogo({ className, showText = false }: MyPALogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Use light logo for dark theme, regular logo for light theme.
  // Default to light-theme logo during SSR to match initial render.
  const logoSrc = mounted && resolvedTheme === "dark" ? "/logo-light.svg" : "/logo.svg"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative w-9 h-9">
        <Image
          src={logoSrc}
          alt="MyPA Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
      {showText && <span className="text-base font-semibold tracking-tight">MyPA</span>}
    </div>
  )
}

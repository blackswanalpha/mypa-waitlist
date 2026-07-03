import Image from "next/image"
import { cn } from "@/lib/utils"

interface MyPALogoProps {
  className?: string
  showText?: boolean
}

/**
 * Both logo variants render and CSS shows the right one, so the correct logo
 * paints on the first frame in either theme. The old hydration swap defaulted
 * to the light-theme logo during SSR while the app's default theme is dark —
 * one frame of dark-ink logo on a dark background on every load.
 */
export function MyPALogo({ className, showText = false }: MyPALogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative w-9 h-9">
        <Image
          src="/logo.svg"
          alt="MyPA Logo"
          fill
          className="object-contain dark:hidden"
          priority
        />
        <Image
          src="/logo-light.svg"
          alt=""
          aria-hidden
          fill
          className="hidden object-contain dark:block"
          priority
        />
      </div>
      {showText && <span className="text-base font-semibold tracking-tight">MyPA</span>}
    </div>
  )
}

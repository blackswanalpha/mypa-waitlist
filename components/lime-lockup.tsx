import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The lime puzzle icon with the MyPA wordmark, as the landing header draws
 * it. `descriptor` is the small caps line under the wordmark.
 */
export function LimeLockup({
  descriptor = "your chief of staff",
  size = 36,
  className,
}: {
  descriptor?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/lime-puzzle.webp"
        alt=""
        width={size}
        height={size}
        priority
        className="rounded-[10px] dark:ring-1 dark:ring-white/15"
        style={{ width: size, height: size }}
      />
      <span className="flex flex-col font-display leading-none">
        <span className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">MyPA</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {descriptor}
        </span>
      </span>
    </span>
  );
}

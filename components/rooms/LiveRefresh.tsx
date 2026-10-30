"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the page every few seconds while something is still happening.
export function LiveRefresh({ active, every = 2000 }: { active: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), every);
    return () => clearInterval(timer);
  }, [active, every, router]);
  return null;
}

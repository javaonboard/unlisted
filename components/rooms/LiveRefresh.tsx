"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the page every few seconds while agents are still talking.
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}

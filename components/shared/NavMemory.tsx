"use client";

import { useEffect } from "react";

// Notes when this tab followed one of our own links, so "Back" can go back instead of guessing.
export function NavMemory() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a");
      if (link && link.origin === location.origin && !link.dataset.back) {
        try {
          sessionStorage.setItem("unlisted:cameFrom", location.pathname);
        } catch {}
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

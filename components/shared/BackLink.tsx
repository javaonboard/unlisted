"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Goes back to the page you came from, scrolled where you were. Opened in a fresh tab: goes to href.
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      data-back="1"
      onClick={(e) => {
        let cameFrom: string | null = null;
        try {
          cameFrom = sessionStorage.getItem("unlisted:cameFrom");
        } catch {}
        if (cameFrom) {
          e.preventDefault();
          router.back();
        }
      }}
      className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
    >
      ← {label}
    </Link>
  );
}

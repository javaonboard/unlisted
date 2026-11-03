"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

type Toast = { text: string; error?: boolean };

// Shows a short confirmation after a money step, e.g. "Paid with PayPal". Survives the page refreshing underneath.
export function showDone(text: string, error = false) {
  window.dispatchEvent(new CustomEvent<Toast>("unlisted:done", { detail: { text, error } }));
}

export function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (e: Event) => {
      setToast((e as CustomEvent<Toast>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 6000);
    };
    window.addEventListener("unlisted:done", show);
    return () => {
      window.removeEventListener("unlisted:done", show);
      clearTimeout(timer);
    };
  }, []);
  if (!toast) return null;
  const Icon = toast.error ? CircleAlert : CircleCheck;
  return (
    <div role="status" className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm shadow-lg ${toast.error ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
        <Icon className="size-5 shrink-0" />
        {toast.text}
      </div>
    </div>
  );
}

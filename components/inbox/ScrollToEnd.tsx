"use client";

import { useEffect } from "react";

// Opens the chat at the newest message, like any messenger.
export function ScrollToEnd() {
  useEffect(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, []);
  return null;
}

// Runs once when the server starts. Checks for unanswered questions,
// unapproved plans, unpaid legs and stale holds every 15 minutes.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runTimeouts } = await import("./lib/jobs/timeouts");
  setInterval(() => runTimeouts().catch((e) => console.error("[timeouts] failed", e?.message)), 15 * 60 * 1000);
}

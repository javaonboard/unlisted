// Runs once when the server starts. When TIMEOUTS_ENABLED=true, checks every
// 15 minutes for unanswered questions, unapproved plans, unpaid legs and stale holds.
// Off by default so a live demo keeps its open deals.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.TIMEOUTS_ENABLED !== "true") return;
  const { runTimeouts } = await import("./lib/jobs/timeouts");
  setInterval(() => runTimeouts().catch((e) => console.error("[timeouts] failed", e?.message)), 15 * 60 * 1000);
}

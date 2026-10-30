import { listen } from "./lib/events/bus";
import { onNeedPosted, onVaultAdded, runDueWaves } from "./lib/suggestions/engine";
import { runTimeouts } from "./lib/jobs/timeouts";
import { resumeStuckRooms } from "./lib/negotiation/resume";

// React to new needs and vault items the moment they are saved.
await listen(async (type, payload) => {
  if (type === "need.posted") await onNeedPosted(payload.needId);
  if (type === "vault.added") await onVaultAdded(payload.itemId);
});

// Every 10 minutes: needs nobody answered widen to the next wave, and rooms a restart stopped carry on.
setInterval(() => {
  runDueWaves().catch((e) => console.error("[waves] failed", e?.message));
  resumeStuckRooms().catch((e) => console.error("[resume] failed", e?.message));
}, 10 * 60 * 1000);

// Reminders and safe defaults for unanswered steps. Off for the demo.
if (process.env.TIMEOUTS_ENABLED === "true") {
  setInterval(() => runTimeouts().catch((e) => console.error("[timeouts] failed", e?.message)), 15 * 60 * 1000);
}

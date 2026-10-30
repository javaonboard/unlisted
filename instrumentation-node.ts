import { listen } from "./lib/events/bus";
import { onNeedPosted, onVaultAdded, runDueWaves } from "./lib/suggestions/engine";
import { runTimeouts } from "./lib/jobs/timeouts";

// React to new needs and vault items the moment they are saved.
await listen(async (type, payload) => {
  if (type === "need.posted") await onNeedPosted(payload.needId);
  if (type === "vault.added") await onVaultAdded(payload.itemId);
});

// The only timer: needs nobody answered for a while widen to the next wave.
setInterval(() => runDueWaves().catch((e) => console.error("[waves] failed", e?.message)), 10 * 60 * 1000);

// Reminders and safe defaults for unanswered steps. Off for the demo.
if (process.env.TIMEOUTS_ENABLED === "true") {
  setInterval(() => runTimeouts().catch((e) => console.error("[timeouts] failed", e?.message)), 15 * 60 * 1000);
}

import { listen } from "./lib/events/bus";
import { onNeedPosted, onVaultAdded, runDueWaves } from "./lib/suggestions/engine";
import { runTimeouts } from "./lib/jobs/timeouts";
import { resumeStuckRooms } from "./lib/negotiation/resume";
import { remindToday } from "./lib/jobs/reminders";
import { checkWaitingPayouts } from "./lib/payments/confirm";
import { dailyCheckIns } from "./lib/agent/checkin";

// React to new needs and vault items the moment they are saved.
await listen(async (type, payload) => {
  if (type === "need.posted") await onNeedPosted(payload.needId);
  if (type === "vault.added") await onVaultAdded(payload.itemId);
});

// Every 10 minutes: needs nobody answered widen to the next wave, rooms a restart stopped carry on,
// people with a handoff today get a reminder, payouts PayPal hasn't confirmed yet get checked,
// and each person's agent takes its daily look.
setInterval(() => {
  remindToday().catch((e) => console.error("[reminders] failed", e?.message));
  checkWaitingPayouts().catch((e) => console.error("[payouts] check failed", e?.message));
  dailyCheckIns().catch((e) => console.error("[checkin] failed", e?.message));
  runDueWaves().catch((e) => console.error("[waves] failed", e?.message));
  resumeStuckRooms().catch((e) => console.error("[resume] failed", e?.message));
}, 10 * 60 * 1000);

// Reminders and safe defaults for unanswered steps. Off for the demo.
if (process.env.TIMEOUTS_ENABLED === "true") {
  setInterval(() => runTimeouts().catch((e) => console.error("[timeouts] failed", e?.message)), 15 * 60 * 1000);
}

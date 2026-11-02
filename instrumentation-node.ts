import { listen } from "./lib/events/bus";
import { onNeedPosted, onItemAdded, runDueWaves } from "./lib/suggestions/engine";
import { runTimeouts } from "./lib/jobs/timeouts";
import { resumeStuckRooms } from "./lib/negotiation/resume";
import { remindToday } from "./lib/jobs/reminders";
import { checkWaitingPayouts } from "./lib/payments/confirm";
import { dailyCheckIns } from "./lib/agent/checkin";
import { nightlyReset } from "./lib/demo/snapshot";

// React to new needs and items the moment they are saved.
await listen(async (type, payload) => {
  if (type === "need.posted") await onNeedPosted(payload.needId);
  if (type === "item.added") await onItemAdded(payload.itemId);
});

// Every 10 minutes: next need waves, resume stopped rooms, handoff reminders, payout checks, daily check-ins,
// and the nightly demo reset.
setInterval(() => {
  remindToday().catch((e) => console.error("[reminders] failed", e?.message));
  checkWaitingPayouts().catch((e) => console.error("[payouts] check failed", e?.message));
  dailyCheckIns().catch((e) => console.error("[checkin] failed", e?.message));
  runDueWaves().catch((e) => console.error("[waves] failed", e?.message));
  resumeStuckRooms().catch((e) => console.error("[resume] failed", e?.message));
  nightlyReset().catch((e) => console.error("[demo] reset failed", e?.message));
}, 10 * 60 * 1000);

// Reminders and safe defaults for unanswered steps. Off for the demo.
if (process.env.TIMEOUTS_ENABLED === "true") {
  setInterval(() => runTimeouts().catch((e) => console.error("[timeouts] failed", e?.message)), 15 * 60 * 1000);
}

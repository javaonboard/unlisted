import { catchUp, listen } from "./lib/events/bus";
import { onDealAgreed, onNeedPosted, onItemAdded, runDueWaves } from "./lib/suggestions/engine";
import { runTimeouts } from "./lib/jobs/timeouts";
import { resumeStuckRooms } from "./lib/negotiation/resume";
import { remindToday } from "./lib/jobs/reminders";
import { checkWaitingPayouts } from "./lib/payments/confirm";
import { dailyCheckIns } from "./lib/agent/checkin";
import { nightlyReset } from "./lib/demo/snapshot";

// React to new needs, new items and agreed deals the moment they happen.
await listen(async (type, payload) => {
  if (type === "need.posted") await onNeedPosted(payload.needId);
  if (type === "item.added") await onItemAdded(payload.itemId);
  if (type === "deal.agreed") await onDealAgreed(payload.roomId);
});

// Every 10 minutes: next need waves, resume stopped rooms, handoff reminders, payout checks, daily check-ins,
// the nightly demo reset, and any events still waiting.
setInterval(() => {
  remindToday().catch((e) => console.error("[reminders] failed", e?.message));
  checkWaitingPayouts().catch((e) => console.error("[payouts] check failed", e?.message));
  dailyCheckIns().catch((e) => console.error("[checkin] failed", e?.message));
  runDueWaves().catch((e) => console.error("[waves] failed", e?.message));
  resumeStuckRooms().catch((e) => console.error("[resume] failed", e?.message));
  nightlyReset().catch((e) => console.error("[demo] reset failed", e?.message));
  catchUp().catch((e) => console.error("[events] catch-up failed", e?.message));
}, 10 * 60 * 1000);

// Reminders and safe defaults for unanswered steps. Off for the demo.
if (process.env.TIMEOUTS_ENABLED === "true") {
  setInterval(() => runTimeouts().catch((e) => console.error("[timeouts] failed", e?.message)), 15 * 60 * 1000);
}

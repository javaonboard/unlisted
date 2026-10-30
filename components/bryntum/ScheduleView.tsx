"use client";

import dynamic from "next/dynamic";
import "./bryntum.css";

// Bryntum only runs in the browser, so it is loaded without server rendering.
const BryntumScheduler = dynamic(
  () => import("@bryntum/scheduler-react").then((mod) => mod.BryntumScheduler),
  { ssr: false },
);

export type Row = { id: string; name: string };
export type Slot = { id: string; resourceId: string; name: string; startDate: string; endDate: string; eventColor?: string };

// A simple timeline: one row per person, one bar per handoff or job.
export function ScheduleView({ rows, slots, from, to }: { rows: Row[]; slots: Slot[]; from: string; to: string }) {
  return (
    <div className="h-72 overflow-hidden rounded-2xl border">
      <BryntumScheduler
        startDate={from}
        endDate={to}
        viewPreset="dayAndWeek"
        rowHeight={70}
        barMargin={8}
        columns={[{ text: "", field: "name", width: 120 }]}
        resources={rows}
        events={slots}
        readOnly
      />
    </div>
  );
}

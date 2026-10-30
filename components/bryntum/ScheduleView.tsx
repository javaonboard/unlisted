"use client";

import dynamic from "next/dynamic";
import "./bryntum.css";

// Bryntum only runs in the browser, so it is loaded without server rendering.
const BryntumScheduler = dynamic(
  () => import("@bryntum/scheduler-react").then((mod) => mod.BryntumScheduler),
  { ssr: false },
);

export type Row = { id: string; name: string };
export type Slot = { id: string; resourceId: string; name: string; startDate: string; endDate: string; eventColor?: string; draggable?: boolean };
export type Free = { id: string; resourceId: string; startDate: string; endDate: string };

type Props = {
  rows: Row[];
  slots: Slot[];
  from: string;
  to: string;
  free?: Free[];
  onFree?: (start: string, end: string) => Promise<void>; // drag across empty time to mark it free
  onMove?: (slotId: string, start: string) => Promise<void>; // drag a bar to ask for another time
};

// One row per person, one bar per handoff or job. Free hours are shaded.
export function ScheduleView({ rows, slots, from, to, free = [], onFree, onMove }: Props) {
  const first = slots[0] ? new Date(new Date(slots[0].startDate).getTime() - 3_600_000) : undefined;

  return (
    <div className="h-48 overflow-hidden rounded-2xl border">
      <BryntumScheduler
        startDate={from}
        endDate={to}
        viewPreset="hourAndDay"
        rowHeight={70}
        barMargin={8}
        columns={[{ text: "", field: "name", width: 120 }]}
        resources={rows}
        events={slots}
        resourceTimeRanges={free.map((f) => ({ ...f, name: "Free", timeRangeColor: "green" }))}
        resourceTimeRangesFeature
        visibleDate={first && { date: first, block: "start" }}
        readOnly={!onFree && !onMove}
        eventEditFeature={false}
        eventMenuFeature={false}
        scheduleMenuFeature={false}
        eventResizeFeature={false}
        eventDragCreateFeature={!!onFree}
        eventDragFeature={!!onMove}
        // The drawn bar is only a gesture: save it, then the page shows it as free time.
        onBeforeDragCreateFinalize={({ context }) => {
          context.async = true;
          onFree?.(context.startDate.toISOString(), context.endDate.toISOString()).finally(() => context.finalize(false));
        }}
        // The bar stays where it was until both sides agree on the new time.
        onBeforeEventDropFinalize={({ context }) => {
          context.async = true;
          onMove?.(String(context.eventRecord.id), context.startDate.toISOString()).finally(() => context.finalize(false));
        }}
      />
    </div>
  );
}

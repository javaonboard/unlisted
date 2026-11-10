"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import "./bryntum.css";

// Bryntum only runs in the browser, so it is loaded without server rendering.
const BryntumScheduler = dynamic(
  () => import("@bryntum/scheduler-react").then((mod) => mod.BryntumScheduler),
  { ssr: false },
);

type Row = { id: string; name: string; role: string; eventColor?: string };
type Slot = { id: string; resourceIds: string[]; name: string; label: string; tip: string; iconCls: string; startDate: string; endDate: string; eventColor?: string; draggable?: boolean };
export type Free = { id: string; resourceId: string; startDate: string; endDate: string };

type Props = {
  me: string;
  rows: Row[];
  slots: Slot[];
  from: string;
  to: string;
  free?: Free[];
  onFree?: (start: string, end: string) => Promise<void>; // drag across empty time to mark it free
  onMove?: (slotId: string, start: string) => Promise<void>; // drag a bar to ask for another time
};

// A handoff shows on both people's rows.
const eventStore = { fields: [{ name: "resourceIds", persist: true }] };

// One row for me and one for each person I meet. Free hours are shaded on my row.
function Schedule({ me, rows, slots, from, to, free = [], onFree, onMove }: Props) {
  const first = slots[0] ? new Date(new Date(slots[0].startDate).getTime() - 3_600_000) : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border">
      <BryntumScheduler
        autoHeight
        startDate={from}
        endDate={to}
        viewPreset={{ base: "hourAndDay", tickWidth: 140 }}
        rowHeight={64}
        barMargin={10}
        eventStyle="rounded"
        columns={[{ type: "resourceInfo", text: "", field: "name", width: 200, showRole: "role", showEventCount: false, useNameAsImageName: false }]}
        resources={rows}
        events={slots}
        eventStore={eventStore}
        // Short bars only fit the icon, so the price and title go beside the bar.
        eventRenderer={() => ""}
        labelsFeature={{ right: { renderer: ({ eventRecord }: { eventRecord: { getData: (f: string) => unknown } }) => [eventRecord.getData("label"), eventRecord.getData("name")].filter(Boolean).join(" · ") }, labelLayoutMode: "estimate" }}
        eventTooltipFeature={{ template: ({ eventRecord }: { eventRecord: { getData: (f: string) => unknown } }) => String(eventRecord.getData("tip") ?? "") }}
        resourceTimeRanges={free.map((f) => ({ ...f, name: "Free", timeRangeColor: "green" }))}
        resourceTimeRangesFeature
        visibleDate={first && { date: first, block: "start" }}
        readOnly={!onFree && !onMove}
        eventEditFeature={false}
        eventMenuFeature={false}
        scheduleMenuFeature={false}
        eventResizeFeature={false}
        eventDragCreateFeature={!!onFree}
        eventDragFeature={onMove ? { constrainDragToResource: true } : false}
        // Free hours are only marked on my own row.
        onBeforeDragCreate={({ resourceRecord }) => resourceRecord.id === me}
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

// Bryntum re-applies every prop on each render, so only re-render when the data really changed.
const data = (p: Props) => JSON.stringify({ ...p, onFree: undefined, onMove: undefined });
export const ScheduleView = memo(Schedule, (a, b) => data(a) === data(b));

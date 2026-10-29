"use client";

import dynamic from "next/dynamic";
import "./bryntum.css";

// Bryntum only runs in the browser, so it is loaded without server rendering.
const BryntumScheduler = dynamic(
  () => import("@bryntum/scheduler-react").then((mod) => mod.BryntumScheduler),
  { ssr: false },
);

export type Mover = { id: string; name: string };
export type Job = {
  id: string;
  resourceId: string;
  name: string;
  startDate: string;
  endDate: string;
  eventColor?: string;
};

export function MoverSchedule({
  movers,
  jobs,
  day,
}: {
  movers: Mover[];
  jobs: Job[];
  day: string; // "2026-10-31"
}) {
  return (
    <div className="h-80 overflow-hidden rounded-lg border">
      <BryntumScheduler
        startDate={`${day}T07:00`}
        endDate={`${day}T19:00`}
        viewPreset="hourAndDay"
        rowHeight={60}
        barMargin={8}
        columns={[{ text: "Mover", field: "name", width: 160 }]}
        resources={movers}
        events={jobs}
      />
    </div>
  );
}

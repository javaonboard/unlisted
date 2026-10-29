import { MoverSchedule } from "@/components/bryntum/MoverSchedule";

// Check page: Marco's Saturday with Maya's bundled pickup booked in.
const day = "2026-10-31";

export default function SchedulePage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-8">
      <h1 className="mb-4 text-2xl font-semibold">Mover schedule</h1>
      <MoverSchedule
        day={day}
        movers={[{ id: "marco", name: "Marco Ruiz" }]}
        jobs={[
          { id: "j1", resourceId: "marco", name: "Other customer", startDate: `${day}T08:00`, endDate: `${day}T09:30`, eventColor: "gray" },
          { id: "j2", resourceId: "marco", name: "Maya: sectional + sofa pickup", startDate: `${day}T10:00`, endDate: `${day}T12:00`, eventColor: "green" },
        ]}
      />
    </main>
  );
}

import { Package, Wrench } from "lucide-react";
import type { Inspection } from "@/lib/vault/inspect";

type Item = { kind: string; photos: string[] };

// The item's first photo, or a plain icon for services and things without one.
export function Thumb({ item, size = "size-12" }: { item: Item; size?: string }) {
  // Data URLs and small local files: next/image adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  if (item.photos[0]) return <img src={item.photos[0]} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />;
  const Icon = item.kind === "skill" ? Wrench : Package;
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-accent text-primary`}>
      <Icon className="size-5" />
    </span>
  );
}

// What the agent saw in the photos, in one short line.
export function seenText(i: Inspection | null | undefined) {
  if (!i) return null;
  if (!i.matches) return `Photo doesn't match: ${i.mismatch ?? "check it"}`;
  const wear = i.wear.length ? i.wear.join(", ") : "no visible wear";
  const working = i.needsWorking ? (i.workingShown ? " · shown working" : " · not shown working yet") : "";
  return `Photo check: ${i.grade}, ${wear}${working}`;
}

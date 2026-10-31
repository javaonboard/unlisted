import {
  CalendarDays, Car, Check, CircleAlert, ClipboardList, Clock, Cpu, Droplets, Glasses, Hammer, House,
  Lamp, MessageCircle, Package, ShoppingBag, Sofa, Sprout, Tag, Truck, UserCheck, Wifi, Wrench, type LucideIcon,
} from "lucide-react";
import type { Next, Role } from "@/lib/anchors/next";

const ROLE: Record<Role["kind"], LucideIcon> = { provider: Wrench, hiring: UserCheck, seller: Tag, buyer: ShoppingBag, plan: ClipboardList };

// Who you are in a deal.
export function RoleBadge({ role }: { role: Role }) {
  const Icon = ROLE[role.kind];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      <Icon className="size-3.5" /> {role.badge}
    </span>
  );
}

const STATE: Record<Next["state"], { icon: LucideIcon; className: string; prefix?: string }> = {
  needs_you: { icon: CircleAlert, className: "bg-red-50 text-red-700 border-red-200", prefix: "Needs you: " },
  waiting: { icon: Clock, className: "bg-amber-50 text-amber-800 border-amber-200" },
  upcoming: { icon: CalendarDays, className: "bg-sky-50 text-sky-800 border-sky-200" },
  talking: { icon: MessageCircle, className: "bg-secondary text-secondary-foreground border-transparent" },
  done: { icon: Check, className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
};

// Where a deal stands, and whether it's on you.
export function StatusPill({ next }: { next: Next }) {
  const { icon: Icon, className, prefix = "" } = STATE[next.state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${className}`}>
      <Icon className="size-3.5" /> {prefix}{next.label}
    </span>
  );
}

const CATEGORY: Record<string, LucideIcon> = {
  sofa: Sofa, lighting: Lamp, "vr-headset": Glasses, gpu: Cpu, moving: Truck, gutters: House, lawn: Sprout,
  "it-setup": Wifi, tools: Hammer, "car-care": Car, washing: Droplets,
};

export function CategoryIcon({ category, className = "size-6" }: { category: string; className?: string }) {
  const Icon = CATEGORY[category] ?? Package;
  return <Icon className={className} />;
}


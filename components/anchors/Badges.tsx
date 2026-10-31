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
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
      <Icon className="size-3.5 text-primary" /> {role.badge}
    </span>
  );
}

const STATE: Record<Next["state"], { icon: LucideIcon; className: string; prefix?: string }> = {
  needs_you: { icon: CircleAlert, className: "bg-primary text-primary-foreground", prefix: "Needs you: " },
  waiting: { icon: Clock, className: "bg-muted text-muted-foreground" },
  upcoming: { icon: CalendarDays, className: "bg-accent text-accent-foreground" },
  talking: { icon: MessageCircle, className: "bg-accent text-accent-foreground" },
  done: { icon: Check, className: "bg-emerald-50 text-emerald-800" },
};

// Where a deal stands, and whether it's on you.
export function StatusPill({ next }: { next: Next }) {
  const { icon: Icon, className, prefix = "" } = STATE[next.state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
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

// A line icon in a soft blue circle, for icons that stand on their own.
export function IconCircle({ icon: Icon, size = "size-8" }: { icon: LucideIcon; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-accent text-primary`}>
      <Icon className="size-4" />
    </span>
  );
}


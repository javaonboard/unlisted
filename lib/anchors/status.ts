type Room = { status: string; agreedPrice: string | null; buyerId: string; sellerId: string };

const ICONS: Record<string, string> = {
  sofa: "🛋️", lighting: "💡", "vr-headset": "🥽", gpu: "🖥️", moving: "🚚", gutters: "🪜", lawn: "🌱", "it-setup": "📶",
};
export const iconFor = (category: string) => ICONS[category] ?? "📦";

// One short line about where an item or need stands.
export function statusLine(rooms: Room[], names: Record<string, string>, viewerId: string, interested = 0) {
  const first = (id: string) => names[id]?.split(" ")[0] ?? id;
  const other = (r: Room) => first(r.buyerId === viewerId ? r.sellerId : r.buyerId);

  const deal = rooms.find((r) => r.status === "agreed");
  if (deal) return `✓ Deal with ${other(deal)} · $${Number(deal.agreedPrice).toFixed(0)}`;
  if (rooms.some((r) => r.status === "waiting_owner")) return "🔔 Your agent has a question";
  const talking = rooms.filter((r) => r.status === "open").length;
  if (talking) return `🟢 ${talking} ${talking === 1 ? "agent" : "agents"} talking`;
  if (rooms.length) return "No deal yet";
  if (interested) return `👀 ${interested} ${interested === 1 ? "person" : "people"} interested`;
  return "Nobody yet";
}

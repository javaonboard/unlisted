import { Highlights } from "./Highlights";
import { NegotiationList } from "./NegotiationList";

type Entries = Parameters<typeof NegotiationList>[0]["entries"] & Parameters<typeof Highlights>[0]["entries"];

// Every chat your agent had about this item or need, in one place: where it stands, then each chat.
export function Talks({ entries, buying }: { entries: Entries; buying: boolean }) {
  return (
    <section className="mt-6 rounded-2xl border p-4">
      <h2 className="mb-3 font-medium">Chats with other agents{entries.length ? ` (${entries.length})` : ""}</h2>
      <Highlights entries={entries} buying={buying} />
      <NegotiationList entries={entries} />
    </section>
  );
}

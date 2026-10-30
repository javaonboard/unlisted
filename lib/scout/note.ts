import { z } from "zod";
import { askForData } from "@/lib/ai/structured";
import { MODELS } from "@/lib/ai/client";
import type { Pick } from "./rank";

const Note = z.object({ note: z.string().describe("Two or three short lines, plain words, no lists of numbers") });

// A short, friendly "why I picked these" for the owner.
export async function scoutNote(plan: { label: string; picks: Pick[]; chosen: number }[]) {
  const text = plan
    .map((p) => `${p.label}: talking to ${p.picks.slice(0, p.chosen).map((x) => `${x.name.split(" ")[0]} (${x.reasons.join(", ")})`).join("; ") || "nobody yet"}${p.picks.length > p.chosen ? `; ${p.picks.length - p.chosen} more as backup` : ""}`)
    .join("\n");
  const { note } = await askForData({
    schema: Note,
    model: MODELS.small,
    content: `You are the user's market scout. Explain in two or three short, friendly lines who you chose to talk to and why. Only use these facts:\n${text}`,
  });
  return note;
}

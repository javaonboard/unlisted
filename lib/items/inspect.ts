import { z } from "zod";
import { and, eq, like } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { askForData } from "@/lib/ai/structured";

const Check = z.object({
  matches: z.boolean().describe("False if the photos clearly show a different kind of thing, or a label shows a different model. If the exact model just can't be confirmed, it still matches: ask for a label photo"),
  mismatch: z.string().nullable().describe("If not, what the photos show instead, in a few words"),
  grade: z.enum(["like new", "good", "fair", "worn"]),
  wear: z.array(z.string()).describe("Each flaw you can actually see, short: 'stain on left cushion', 'scratch on top'. Empty if none"),
  condition: z.string().describe("One short line a buyer can trust, from what you see"),
  needsWorking: z.boolean().describe("A buyer would want to see this working before paying: electronics, appliances, anything with a motor or power. Not furniture or simple tools"),
  workingShown: z.boolean().describe("The photos or video frames show it powered on or in use"),
  ask: z.string().nullable().describe("One short request to the owner for a better photo or proof it works, or null if nothing is missing"),
});

export type Inspection = z.infer<typeof Check> & { at: string; photos: number };

// The agent looks at the owner's photos (or frames from a short video): is it the item,
// what wear shows, and is it shown working when that matters. Findings become verified evidence.
export async function inspectItem(itemId: string, images: string[], fromVideo = false, ip?: string): Promise<Inspection> {
  const [item] = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
  const before = item.inspection?.matches ? item.inspection : null;
  const check = await askForData({
    schema: Check,
    ip,
    content: [
      ...images.map((url) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: url.split(",")[1] } })),
      {
        type: "text",
        text: `${fromVideo ? "These are frames from a short video" : "These are photos"} an owner added for: "${item.title}" (${item.category}).
The owner says: "${item.condition ?? "nothing about condition"}".
${before ? `Earlier photos showed: ${before.grade}, ${before.wear.join(", ") || "no visible wear"}${before.workingShown ? ", shown working" : ""}. Keep those findings unless these show otherwise.` : ""}
Check it like a careful buyer would. Only report what you can see; don't guess hidden damage.`,
      },
    ],
  });
  console.log("[ai] inspected", item.title, check.grade, check.wear.length, "flaws", check.matches ? "" : "MISMATCH");

  const inspection: Inspection = { ...check, workingShown: check.workingShown || Boolean(before?.workingShown), at: new Date().toISOString(), photos: images.length + (before?.photos ?? 0) };
  if (!check.matches) return inspection; // a wrong photo changes nothing
  await db.update(schema.items).set({ inspection }).where(eq(schema.items.id, itemId)); // the owner's own words stay as they are

  // What the agent saw replaces its earlier findings, so agents only cite the latest.
  await db.delete(schema.evidence).where(and(eq(schema.evidence.itemId, itemId), like(schema.evidence.summary, "Photo check:%")));
  const seen = check.wear.length ? check.wear.join("; ") : "no visible wear";
  const rows = [{ itemId, type: "photo" as const, summary: `Photo check: ${check.grade}, ${seen}.`, verified: true }];
  if (inspection.workingShown) rows.push({ itemId, type: "photo", summary: "Photo check: shown working.", verified: true });
  await db.insert(schema.evidence).values(rows);
  return inspection;
}

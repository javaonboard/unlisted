import { z } from "zod";
import { askForData } from "@/lib/ai/structured";
import { findProductsInPhoto, type ProductMatch } from "./products";

const PhotoResult = z.object({
  goods: z.array(
    z.object({
      title: z.string().describe("Short name, e.g. 'Grey 3-seat sectional'"),
      category: z.string().describe("One lowercase word or slug, e.g. 'sofa', 'lighting', 'vr-headset', 'gpu', 'bike', 'tools'"),
      condition: z.string().describe("What you can actually see: stains, wear, damage. Say 'looks good' if nothing."),
      usedValue: z.number().describe("Fair used price in USD"),
      matchIndex: z.number().nullable().describe("Index of the matching product in the list, or null"),
    }),
  ),
  skills: z.array(
    z.object({
      title: z.string().describe("A service a person could offer, e.g. 'Gutter cleaning'"),
      category: z.string().describe("One of: moving, gutters, lawn, car-care, it-setup, washing, assembly, or a short new word"),
      because: z.string().describe("The equipment in the photo that suggests it"),
    }),
  ),
});

export type PhotoAnalysis = z.infer<typeof PhotoResult> & { matches: ProductMatch[] };

// Turns one room or garage photo into vault cards: goods to keep or sell,
// and skills the owner's equipment suggests they could offer.
export async function analyzePhoto(
  base64Image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  ip?: string,
): Promise<PhotoAnalysis> {
  const matches = await findProductsInPhoto(base64Image);
  const list = matches
    .map((m, i) => `${i}. ${m.thing} → ${m.title ?? "no match"}${m.newPrice ? `, new $${m.newPrice}` : ""}`)
    .join("\n");

  const result = await askForData({
    schema: PhotoResult,
    ip,
    content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
      {
        type: "text",
        text: `This is a photo of someone's home. A product search found these items:
${list}

List the goods worth keeping track of, with condition you can see and a fair used price
(use the new price as a ceiling). Skip fixtures like walls, floors and built-ins.
Also list services this person could offer to neighbors based on equipment you see
(for example a ladder suggests gutter cleaning). Leave skills empty if there are none.`,
      },
    ],
  });

  console.log("[ai] photo analyzed:", result.goods.length, "goods,", result.skills.length, "skills");
  return { ...result, matches };
}

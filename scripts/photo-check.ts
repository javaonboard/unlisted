// Day-1 check: one photo becomes vault cards.
//   npm run photo:check -- <path-to-photo.jpg>
import { readFileSync } from "node:fs";
import { analyzePhoto } from "@/lib/vault/photo";

async function main() {
  const path = process.argv[2];
  const type = path.endsWith(".png") ? "image/png" : "image/jpeg";
  const result = await analyzePhoto(readFileSync(path).toString("base64"), type);

  for (const g of result.goods) {
    const match = g.matchIndex !== null ? result.matches[g.matchIndex] : undefined;
    console.log(`goods: ${g.title} | ${g.condition} | used ~$${g.usedValue}${match?.newPrice ? ` (new $${match.newPrice})` : ""}`);
  }
  for (const s of result.skills) console.log(`skill: ${s.title} (because: ${s.because})`);
  process.exit(0); // the database pool would keep the script running
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});

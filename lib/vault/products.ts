import { Channel3 } from "@channel3/sdk";

let client: Channel3 | undefined;
const channel3 = () => (client ??= new Channel3({ apiKey: process.env.CHANNEL3_API_KEY! }));

export type ProductMatch = {
  thing: string; // what Channel3 saw, e.g. "sectional sofa"
  title?: string; // closest real product
  newPrice?: number; // retail price, used as an anchor
  url?: string;
};

type Product = { title?: string; offers?: { url?: string; price?: { price?: number } }[] };

// Finds the objects in a photo and the closest real product for each.
export async function findProductsInPhoto(base64Image: string): Promise<ProductMatch[]> {
  const result = await channel3().experimental.findProductsInImage({
    base64_image: base64Image,
    limit: 1,
    max_things: 6, // Channel3 maximum
  });

  console.log("[channel3] found", result.things.length, "things");
  return result.things.map((thing) => {
    const best = thing.matches?.[0] as Product | undefined;
    return {
      thing: thing.thing,
      title: best?.title,
      newPrice: best?.offers?.[0]?.price?.price,
      url: best?.offers?.[0]?.url,
    };
  });
}

// Looks up real products by name, so an agent can check specs and prices (e.g. what power a card needs).
export async function lookUpProduct(query: string) {
  const page = await channel3().products.search({ query, limit: 3 });
  console.log("[channel3] looked up", query, page.data.length);
  return page.data.map((p) => ({
    title: p.title,
    price: (p.offers?.[0] as { price?: { price?: number } } | undefined)?.price?.price ?? null,
    features: (p.key_features ?? []).slice(0, 6),
    description: p.description?.slice(0, 300) ?? null,
  }));
}

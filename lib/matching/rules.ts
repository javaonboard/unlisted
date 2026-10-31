// A need's number requirements against an item's specs, whatever the AI named them:
// "minSeats: 3" needs "seats" ≥ 3, "maxWidthIn: 80" needs "widthIn" ≤ 80, "minWatts: 650" needs "watts" ≥ 650.
export function meetsRequirements(specs: Record<string, unknown>, wanted: Record<string, unknown>) {
  return Object.entries(wanted).every(([key, limit]) => {
    const rule = /^(min|max)(.+)$/.exec(key);
    if (!rule || typeof limit !== "number") return true; // not a number rule: leave it to the agents
    const name = rule[2][0].toLowerCase() + rule[2].slice(1);
    const value = specs[name];
    if (typeof value !== "number") return true; // unknown on the item: the agents can ask
    return rule[1] === "min" ? value >= limit : value <= limit;
  });
}

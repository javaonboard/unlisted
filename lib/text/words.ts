// A title used mid-sentence: "Grey 3-seat sectional" → "grey 3-seat sectional",
// but names and acronyms keep their capitals ("RTX 4070", "Wi-Fi", "Quest 3").
export const inSentence = (title: string) =>
  title
    .split(" ")
    .map((w) => (/^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w))
    .join(" ");

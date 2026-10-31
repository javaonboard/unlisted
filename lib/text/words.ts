// A title used mid-sentence. Only plain sentence-case titles get a lowercase first word:
// "Grey 3-seat sectional" → "grey 3-seat sectional", "Gutter cleaning" → "gutter cleaning".
// Names keep their capitals: "Meta Quest 3", "RTX 4070 graphics card", "Wi-Fi, TV mounting".
export const inSentence = (title: string) => {
  const [head, ...rest] = title.split(" ");
  const sentenceCase = /^[A-Z][a-z]+$/.test(head) && rest.every((w) => !/[A-Z]/.test(w));
  return sentenceCase ? [head.toLowerCase(), ...rest].join(" ") : title;
};

// A title used mid-sentence: "Gutter cleaning" becomes "gutter cleaning", names like "Meta Quest 3" keep their capitals.
export const inSentence = (title: string) => {
  const [head, ...rest] = title.split(" ");
  const sentenceCase = /^[A-Z][a-z]+$/.test(head) && rest.every((w) => !/[A-Z]/.test(w));
  return sentenceCase ? [head.toLowerCase(), ...rest].join(" ") : title;
};

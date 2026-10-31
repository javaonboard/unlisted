export type Block = { type: "p" | "ul" | "ol"; lines: string[] };

// AI text often runs points together ("Here's the plan: 1. ... 2. ..."). Put each point on its
// own line, then group lines into paragraphs and lists.
export function toBlocks(text: string): Block[] {
  const lines = text
    .replace(/\s+(?=\d+\.\s)/g, "\n") // " 2. next" starts a new line
    .replace(/\s+(?=[•▪]\s)/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: Block[] = [];
  for (const line of lines) {
    const type = /^\d+\.\s/.test(line) ? "ol" : /^[-*•▪]\s/.test(line) ? "ul" : "p";
    const content = type === "p" ? line : line.replace(/^(\d+\.|[-*•▪])\s+/, "");
    const last = blocks.at(-1);
    if (last && last.type === type && type !== "p") last.lines.push(content);
    else blocks.push({ type, lines: [content] });
  }
  return blocks;
}

// "**bold**" pieces, for the renderer.
export const boldParts = (line: string) => line.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) => (part.startsWith("**") ? { bold: true, text: part.slice(2, -2) } : { bold: false, text: part }));

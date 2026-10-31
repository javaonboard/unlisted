import { boldParts, toBlocks } from "@/lib/text/blocks";

const Line = ({ text }: { text: string }) => (
  <>{boldParts(text).map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}</>
);

// Text from the agents, with its lists and bold shown properly instead of one long run.
export function FormattedText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {toBlocks(text).map((b, i) =>
        b.type === "p" ? (
          <p key={i}><Line text={b.lines[0]} /></p>
        ) : b.type === "ol" ? (
          <ol key={i} className="list-decimal space-y-0.5 pl-5">{b.lines.map((l, j) => <li key={j}><Line text={l} /></li>)}</ol>
        ) : (
          <ul key={i} className="list-disc space-y-0.5 pl-5">{b.lines.map((l, j) => <li key={j}><Line text={l} /></li>)}</ul>
        ),
      )}
    </div>
  );
}

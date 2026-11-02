// Behavioral signals about the other side. Only from what they did in this
// room, never from their profile, private things or memory.

type PastMove = { fromUserId: string; price: string | null; kind: string };

export function counterpartySignals(input: {
  moves: PastMove[];
  counterpartyId: string;
  counterpartyDueAt: Date | null;
  competingInterest: number; // other open intents for the same thing
  round: number;
  maxRounds: number;
}): string[] {
  const signals: string[] = [];
  const theirPrices = input.moves
    .filter((m) => m.fromUserId === input.counterpartyId && m.price)
    .map((m) => Number(m.price));

  if (theirPrices.length >= 2) {
    const first = theirPrices[0];
    const last = theirPrices[theirPrices.length - 1];
    const moved = Math.abs(last - first);
    const pct = Math.round((moved / first) * 100);
    signals.push(pct >= 10 ? `They have moved ${pct}% already: flexible.` : `They have moved only ${pct}%: firm.`);
  }

  if (input.counterpartyDueAt) {
    const days = Math.ceil((input.counterpartyDueAt.getTime() - Date.now()) / 86_400_000);
    if (days <= 3) signals.push(`Their stated deadline is in ${days} day(s): speed matters to them.`);
  }
  if (input.competingInterest > 0) {
    signals.push(`${input.competingInterest} other people want the same thing (verified count).`);
  }

  const left = input.maxRounds - input.round;
  if (left <= 2) signals.push(`Only ${left} round(s) left before the room closes.`);
  return signals;
}

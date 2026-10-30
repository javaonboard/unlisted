// The coming Saturday (or today if it is Saturday), at the given hour, local time.
export function nextSaturday(hour = 0) {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  d.setHours(hour, 0, 0, 0);
  return d;
}

// One session = one 6am-to-6am (UTC) play day. Games regularly cross
// midnight; almost none cross 6am, so shifting the boundary keeps a late
// session as a single session.

const SHIFT_MS = 6 * 60 * 60 * 1000;

/** The session day (UTC date at midnight) a roll timestamp belongs to. */
export function sessionDayOf(rolledAt: Date): Date {
  const shifted = new Date(rolledAt.getTime() - SHIFT_MS);
  return new Date(`${shifted.toISOString().slice(0, 10)}T00:00:00Z`);
}

/** Parse a "YYYY-MM-DD" session date into the DATE-column Date value. */
export function sessionDayFrom(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

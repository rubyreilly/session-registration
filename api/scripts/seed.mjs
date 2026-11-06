// Usage (API must be running): npm run seed
// All offsets are relative to "now", so each session stays in its intended
// state for at least a week after seeding.
const BASE = process.env.API_URL ?? 'http://localhost:3000/api';
const DAY = 24 * 3600 * 1000;
const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const sessions = [
  {
    title: 'Open session',
    startsAt: at(15 * DAY),
    capacity: 5,
    registrationOpensAt: at(-7 * DAY),
    registrationClosesAt: at(14 * DAY),
  },
  {
    title: 'Full session (capacity 1)',
    startsAt: at(15 * DAY),
    capacity: 1,
    registrationOpensAt: at(-7 * DAY),
    registrationClosesAt: at(14 * DAY),
  },
  {
    title: 'Registration closed',
    startsAt: at(15 * DAY),
    capacity: 5,
    registrationOpensAt: at(-14 * DAY),
    registrationClosesAt: at(-1 * DAY),
  },
  {
    title: 'Registration not open yet',
    startsAt: at(20 * DAY),
    capacity: 5,
    registrationOpensAt: at(10 * DAY),
    registrationClosesAt: at(18 * DAY),
  },
];

const created = [];
for (const s of sessions) created.push(await post('/sessions', s));

// Fill the capacity-1 session so the UI shows "full".
await post(`/sessions/${created[1].id}/registrations`, { email: 'taken@example.com' });

console.log(`Seeded ${created.length} sessions.`);

# Call Time Alarm Clock

Work backwards from a call time to the alarm you actually need.

You enter a call time and the address you report to. The app already knows
where you start from, how long you take to get ready, and how early you like
to be standing there. It routes the commute with live traffic, works the whole
chain backwards, and gives you one screen you can screenshot.

Not department-dependent — the only job detail it needs is when and where.

## What it tells you

- **Two alarms** — when to wake up, and when to be out the door. Both are
  first-class, because the second one is the one you actually miss.
- **Get ready / Travel / Arrive / Call** — the chain, so you can see where the
  time went.
- **On-time likelihood** — a percentage, capped at 99%. Nothing is certain.
- **A flag when late is possible** — if the pessimistic traffic case lands you
  past call, the card turns amber. If the odds fall below your threshold, red.
- **Directions** — opens Google Maps from wherever you're standing to the lot.
- **A "right lot?" prompt** — because basecamp is not the stage, and the wrong
  lot is the most common way to be late.

Both address fields autocomplete against Google Places, so "Universal Studios —
Gate 2" and "Gate 8" come back as separate rows with separate addresses instead
of one ambiguous string.

## The late-risk model

Google's Routes API returns an optimistic, best-guess, and pessimistic duration
for a drive. Those behave like a rough 10th/90th percentile bracket, so the app
backs a standard deviation out of their width and treats travel time as normally
distributed around the best guess.

On-time likelihood is then the probability that the real trip fits inside the
budget between leaving and call time. Two deliberate choices:

- **It never reports better than 99%.** That is the "assuming nothing goes
  wrong" ceiling — a flat tire is not in the traffic data.
- **Every estimate carries a noise floor** of at least 2 minutes, or 5% of the
  trip. A ten-minute walk is not deterministic either.

A wide traffic bracket therefore reads as riskier than a narrow one for the
same buffer, which is the whole point of asking for the spread.

Traffic depends on when you leave, but when you leave depends on the traffic.
The planner resolves that loop by re-querying with the refined departure time
(`src/lib/schedule.ts`).

## Running it

```bash
npm install
npm run dev
```

Add it to your iPhone home screen from Safari and it runs full-screen.

### Maps data

Without a key it runs on mock providers — invented distances, and a bundled
list of real studio lots for autocomplete. The banner under the plan says so.

To go live, enable both the **Routes API** and the **Places API (New)** on a
Google Cloud key and:

```bash
cp .env.example .env.local
# set VITE_GOOGLE_MAPS_API_KEY=...
```

No code changes — `createMapsProvider()` and `createPlacesProvider()` both pick
the live provider when a key is present. Autocomplete passes a session token so
the keystrokes leading to one pick bill as a single session.

Note the key ships in the client bundle, so restrict it by HTTP referrer in the
Google Cloud console.

## Layout

```
src/lib/risk.ts        on-time likelihood from the traffic spread
src/lib/schedule.ts    works the chain backwards; resolves the traffic loop
src/lib/maps/          routing: provider interface, Google Routes, and the mock
src/lib/places/        autocomplete: same shape, Google Places and a mock
src/lib/time.ts        clock math and formatting
src/components/        call form, address field, plan card, preferences
```

```bash
npm test        # 31 tests over risk, scheduling, time math, and place lookup
npm run build
```

## Known limits

- **No alarm is set for you.** iOS gives the web no way into the Clock app, so
  the app shows the time and you set it. This is the main reason to eventually
  port to native.
- **Non-driving modes get no spread.** Google only accepts a traffic model for
  driving, so transit, bike, and walk fall back to the noise floor.
- **Autocomplete suggests, it does not verify.** A picked suggestion is a real
  place, but nothing checks it is the lot *your* production meant — so the
  "right lot?" confirmation stays.

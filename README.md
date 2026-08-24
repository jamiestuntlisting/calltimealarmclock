# Call Time Alarm Clock

Work backwards from a call time to the alarm you actually need.

You enter a call time and the address you report to. The app already knows
where you start from, how long you take to get ready, and how early you like
to be standing there. It routes the commute with live traffic, works the whole
chain backwards, and gives you one screen you can screenshot.

Not department-dependent — the only job detail it needs is when and where.

## What it tells you

- **Two alarms** — when to wake up, and when to be out the door. Both are
  first-class, because the second one is the one you actually miss. On transit
  the second one is a real scheduled departure, not a derived time.
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

Risk means something different per mode, so the app models it differently.

**Driving is traffic.** Google's Routes API returns an optimistic, best-guess,
and pessimistic duration. Those behave like a rough 10th/90th percentile
bracket, so the app backs a standard deviation out of their width and treats
travel time as normally distributed around the best guess.

**Transit is missing your connection.** There is no traffic model for transit —
but there is something better. Google answers *arrival-time* queries against
the timetable, so the app asks the question a commuter actually asks ("what
gets me there by 5:45?") and gets back a real scheduled departure instead of a
derived clock time. The downside comes from `headway`, the gap until the next
departure from that stop: miss it and you lose exactly that long.

That makes the transit bracket one-sided — you cannot beat a timetable — so its
full width is read as a single tail rather than halved into two. The same
20-minute spread therefore implies twice the deviation it would on a road,
which is correct: a 20-minute-headway train is genuinely riskier than a drive
that varies 20 minutes either side of its estimate.

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

## Deploying

Requires **Node 22+** — Wrangler refuses to run below that, and the build
succeeds first, so on an older Node the failure lands on the very last line.
`.nvmrc` pins it: `nvm use` picks up the right version.

Static site on Workers, no Worker script:

```bash
nvm use               # or otherwise get onto Node 22+
npx wrangler login    # once
npm run deploy        # builds, then deploys
```

That prints the live URL — `calltime-alarm-clock.<your-subdomain>.workers.dev`.
Open it in Safari on the phone and Add to Home Screen.

Or connect the repo in the dashboard (Workers & Pages → Create application →
Import a repository) and skip the local toolchain entirely — Cloudflare builds
it. Build command `npm run build`, deploy command `npx wrangler deploy`. Two
things to get right: the Worker name in the dashboard must match `name` in
`wrangler.jsonc` (`calltime-alarm-clock`) or the build fails, and Branch
control defaults to the repo's default branch — point it at the branch you
actually want deployed.

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
npm test        # 43 tests over risk, scheduling, transit, time math, and places
npm run build
```

## Known limits

- **No alarm is set for you.** iOS gives the web no way into the Clock app, so
  the app shows the time and you set it. This is the main reason to eventually
  port to native.
- **Walking and cycling get no spread.** No traffic model and no timetable, so
  they fall back to the noise floor. That is roughly right — neither has much
  variance — but it is a floor, not a measurement.
- **Transit assumes you make the first train.** The model prices in one missed
  connection at the worst headway on the route. It does not model a train that
  is cancelled outright, or a line that is down.
- **Autocomplete suggests, it does not verify.** A picked suggestion is a real
  place, but nothing checks it is the lot *your* production meant — so the
  "right lot?" confirmation stays.

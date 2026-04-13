# IntentTerm V1

Internal browser-based tool for comparing 2 to 10 candidate terms with Semrush data and recommending:

- best primary term
- best secondary term
- terms to use in supporting copy
- terms to avoid as primary targets

## Stack

- Frontend: static HTML, CSS, and vanilla JavaScript
- Backend: lightweight Node.js HTTP server
- Data source: Semrush SEO API

## Requirements

- Node.js 20+
- `SEMRUSH_API_KEY` in the environment

## Run locally

Option 1:

```bash
cp .env.example .env
```

Then add your real `SEMRUSH_API_KEY` to `.env` and run:

```bash
npm start
```

Option 2:

```bash
export SEMRUSH_API_KEY=your_key_here
npm start
```

## Standalone folder handoff

For an internal desktop handoff on macOS:

1. Keep this whole folder together.
2. Include the real `.env` file.
3. Have Node.js 20+ installed on the target machine.
4. Launch the app by double-clicking [start.command](/Users/scottstadum/Desktop/Projects/Apps/CHE/IntentTerm/start.command).

What to send:

- the full `IntentTerm` folder
- `.env` with the Semrush key

What your boss does:

1. Install Node.js if it is not already installed.
2. Open the folder.
3. Double-click `start.command`.
4. Use the app in the browser at `http://127.0.0.1:3000`.

Notes:

- The Terminal window opened by `start.command` needs to stay open while the app is running.
- If macOS blocks the script the first time, right-click `start.command` and choose Open.

Then open [http://localhost:3000](http://localhost:3000).

## Included in V1

- Candidate term validation for blank and duplicate inputs
- Database selection for `US`, `UK`, and `CA`
- Content goal selection
- Comparison table with:
  - search volume
  - keyword difficulty
  - CPC
  - intent
  - trend direction
  - related keyword count
  - recommendation label
- Weighted recommendation logic
- CSV export
- Clear API and insufficient-data states

## Notes

- The app uses the Semrush `phrase_these` endpoint for bulk keyword metrics and `phrase_related` to estimate related keyword count.
- Related keyword count is calculated by counting returned related-keyword rows from Semrush.
- CSV export is generated in the browser from the most recent comparison result.

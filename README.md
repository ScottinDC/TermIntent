# IntentTerm

Browser-based tool for comparing candidate terms with Semrush data and recommending:

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

## Deploy architecture

This repo is now set up for:

- frontend on GitHub Pages
- backend API on a separate Node host

GitHub Pages serves the contents of [`public`](/Users/scottstadum/Desktop/Projects/Apps/AWE%20CHE%20/TermIntent/public). The API remains in [`server.js`](/Users/scottstadum/Desktop/Projects/Apps/AWE%20CHE%20/TermIntent/server.js) so the Semrush key stays on the server.

## GitHub Pages deployment

The workflow at [.github/workflows/deploy-pages.yml](/Users/scottstadum/Desktop/Projects/Apps/AWE%20CHE%20/TermIntent/.github/workflows/deploy-pages.yml) deploys the `public` folder to GitHub Pages on every push to `main`.

Before pushing, set the API origin in [`public/config.js`](/Users/scottstadum/Desktop/Projects/Apps/AWE%20CHE%20/TermIntent/public/config.js):

```js
window.TERMINTENT_CONFIG = {
  API_BASE_URL: "https://your-api-host.example.com"
};
```

Then in GitHub:

1. Open the repository settings.
2. Go to Pages.
3. Set the source to GitHub Actions.

Your frontend URL will be:

`https://scottindc.github.io/TermIntent/`

## Backend deployment

You can deploy the API to any Node host. A starter Render config is included in [`render.yaml`](/Users/scottstadum/Desktop/Projects/Apps/AWE%20CHE%20/TermIntent/render.yaml).

Required backend environment variables:

- `SEMRUSH_API_KEY`
- `APP_PASSWORD`
- `HOST=0.0.0.0`
- `PORT=10000` on Render, or the port your host expects
- `ALLOWED_ORIGINS=https://scottindc.github.io`

If you want to allow both the GitHub Pages site and local development:

```bash
ALLOWED_ORIGINS=https://scottindc.github.io,http://127.0.0.1:3000
```

After the backend URL is live, update [`public/config.js`](/Users/scottstadum/Desktop/Projects/Apps/AWE%20CHE%20/TermIntent/public/config.js) to point to it and push again.

## Shared password gate

Set `APP_PASSWORD` on the backend if you want the public frontend to require a shared password before anyone can run comparisons.

This is a lightweight shared-secret gate, not full user-account authentication. It is useful for basic access control, but it should not be treated as a substitute for proper per-user auth.

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
- Cross-origin requests are restricted by `ALLOWED_ORIGINS` on the backend.

# NERO Tube

Standalone NERO-branded video discovery and player. Searches Invidious public instances first and falls back to Piped. No YouTube Data API key is required.

## Run locally

- Requires Node.js 20 or newer.
- Run `npm start`.
- Open `http://localhost:10000`.

## Deploy to Render

1. Create a **Web Service** and connect this repository.
2. Runtime: **Node**.
3. Build command: `npm install` (there are no external dependencies).
4. Start command: `npm start`.
5. Render provides the `PORT` environment variable automatically.

## Features

- Search and browse videos through public Invidious instances.
- Automatic Piped fallback when Invidious is unavailable.
- Responsive desktop and mobile layout.
- Shareable video URLs using `?v=VIDEO_ID`.
- Saved videos and watch history stored locally in the browser.

Public third-party instances are community-operated and may be slow, unavailable, or restrict browser requests. NERO Tube does not host video files.

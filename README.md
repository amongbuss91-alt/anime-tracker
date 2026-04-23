# Anime Tracker

A simple anime tracking web app built with vanilla HTML/CSS/JS and AniList search.

## Features

- No login page — start tracking immediately.
- Search anime titles using AniList GraphQL API.
- Add anime to your personal list.
- Update watch progress and status (`Planning`, `Watching`, `Completed`).
- Remove anime from your list.
- Dashboard stats for total anime, watching, completed, and total episodes watched.
- Filter your list by status.
- Data is stored locally in your browser (`localStorage`).

## Files

- `index.html` – app layout and sections.
- `style.css` – styles for cards, stats, and responsive layout.
- `app.js` – app logic for search, list CRUD, filtering, stats, and local storage.

## Run locally

Use any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

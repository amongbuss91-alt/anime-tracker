# Anime Tracker

A simple anime tracking web app built with vanilla HTML/CSS/JS, Supabase Auth + Database, and AniList search.

## Features

- Email/password sign up and login.
- Search anime titles using AniList GraphQL API.
- Add anime to your personal list.
- Update watch progress and status (`Planning`, `Watching`, `Completed`).
- Remove anime from your list.
- Dashboard stats for total anime, watching, completed, and total episodes watched.
- Filter your list by status.

## Files

- `index.html` – app layout and sections.
- `style.css` – styles for cards, stats, and responsive layout.
- `app.js` – app logic for auth, search, list CRUD, filtering, and stats.
- `supabase.js` – Supabase client initialization.

## Database table

Create a table named `anime_list` in Supabase with at least these columns:

- `user_id` (uuid)
- `anime_id` (bigint or integer)
- `title` (text)
- `cover_image` (text)
- `episodes_total` (integer)
- `progress` (integer)
- `status` (text)
- `updated_at` (timestamp, default now())

Recommended unique constraint:

- `(user_id, anime_id)`

## Run locally

Use any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

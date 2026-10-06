# Website requirements

What this site must do. Use this as the checklist when changing it.

## Data
- Look up any AniList username and show that user's manga-type list: manhwa, manga, manhua and novels.
- AniList is the only source for tracking (list, progress, status, covers, genres, tags, ratings).
- Only five statuses: Reading, Completed, On hold, Plan to read, Dropped.
- Ratings mean AniList's average score, never the user's own score.
- Changes on AniList appear without reloading (refresh about every 30 seconds).
- MangaUpdates and MangaBaka are used only to find alternate names for search. Never for tracking.
- No MangaDex.

## Pages
- **Home** (StoryShelf): wood-table design, username search, recent searches. The brand is not clickable here.
- **All other pages** (StoryShelf Tracker): the brand links back to the home page. Tabs: Library, Genres, Stats.
- **Profile header**: AniList banner, avatar and name (name links to AniList). Top bar transparent over the banner until hover or scroll.
- **Library**: A-Z by default; Organize by (Title A-Z, Recently read, Recently added, Publication, Rating, Type); filters for type, status and genres (all must match); search that also matches alternate names; pagination 24 / 48 / 96 (default 24); Adult and Suggestive labels with tinted cards; tag filter from Stats. No reverse-order button, no table view.
- **Genres**: genres by type (bars), genre pairing heatmap.
- **Stats**: reading activity tiles (today, this week, this month, current streak), 30-day line chart, 12-month heatmap, tags by type with shortened names. Counts come from the AniList activity feed.

## Look
- Dark violet theme with a wood-table home page. Works on phones with no sideways page scrolling.
- Charts use accessible colors, tooltips and keyboard focus.

## Technical
- Static files only (no build step, no server). All links are relative.
- Files: `index.html`, `library.html`, `genres.html`, `stats.html`, `site.css`, `site.js`.

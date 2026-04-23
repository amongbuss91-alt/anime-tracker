const STORAGE_KEY = "anime_tracker_list_v1";
let myAnimeList = loadLocalList();

const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");

statusFilter.onchange = () => renderList(myAnimeList);
document.getElementById("search-btn").onclick = () => searchAnime();
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchAnime();
  }
});

renderList(myAnimeList);
updateStats(myAnimeList);

function loadLocalList() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalList() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(myAnimeList));
}

async function searchAnime() {
  const query = searchInput.value.trim();
  if (!query) {
    return;
  }

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($search:String){Page{media(search:$search,type:ANIME){id episodes title{romaji} coverImage{large}}}}`,
      variables: { search: query },
    }),
  });

  const data = await res.json();
  renderSearch(data?.data?.Page?.media || []);
}

function renderSearch(list) {
  const searchResults = document.getElementById("search-results");
  searchResults.innerHTML = "";

  if (!list.length) {
    searchResults.innerHTML = `<p class="muted">No anime found.</p>`;
    return;
  }

  list.forEach((anime) => {
    const isAdded = myAnimeList.some((item) => item.anime_id === anime.id);
    const el = document.createElement("div");
    el.className = "anime-card";
    el.innerHTML = `<img src="${anime.coverImage.large}" alt="${anime.title.romaji}"><div class="anime-card-content"><h3>${anime.title.romaji}</h3><button ${isAdded ? "disabled" : ""}>${isAdded ? "Added" : "Add"}</button></div>`;
    if (!isAdded) {
      el.querySelector("button").onclick = () => addAnime(anime);
    }
    searchResults.appendChild(el);
  });
}

function addAnime(anime) {
  myAnimeList.unshift({
    anime_id: anime.id,
    title: anime.title.romaji,
    cover_image: anime.coverImage.large,
    episodes_total: anime.episodes || 0,
    progress: 0,
    status: "Planning",
    updated_at: new Date().toISOString(),
  });

  saveLocalList();
  renderList(myAnimeList);
  updateStats(myAnimeList);
}

function renderList(list) {
  const filterValue = statusFilter.value;
  const filtered =
    filterValue === "All" ? list : list.filter((anime) => anime.status === filterValue);

  const myList = document.getElementById("my-list");
  myList.innerHTML = "";

  if (!filtered.length) {
    myList.innerHTML = `<p class="muted">No anime in this filter yet.</p>`;
    return;
  }

  filtered.forEach((anime) => {
    const maxEpisodes = anime.episodes_total || "?";
    const el = document.createElement("div");
    el.className = "anime-card";
    el.innerHTML = `<img src="${anime.cover_image}" alt="${anime.title}"><div class="anime-card-content"><h3>${anime.title}</h3><p class="muted">Episodes: ${maxEpisodes}</p><input type="number" min="0" value="${anime.progress}" class="progress"><button class="plus">+1</button><select class="status"><option ${anime.status === "Planning" ? "selected" : ""}>Planning</option><option ${anime.status === "Watching" ? "selected" : ""}>Watching</option><option ${anime.status === "Completed" ? "selected" : ""}>Completed</option></select><div class="row-buttons"><button class="save">Save</button><button class="danger remove">Remove</button></div></div>`;

    el.querySelector(".plus").onclick = () => {
      const input = el.querySelector(".progress");
      const next = Number(input.value) + 1;
      if (anime.episodes_total && next > anime.episodes_total) {
        input.value = anime.episodes_total;
        return;
      }
      input.value = next;
    };

    el.querySelector(".save").onclick = () => updateAnime(anime.anime_id, el);
    el.querySelector(".remove").onclick = () => removeAnime(anime.anime_id);

    myList.appendChild(el);
  });
}

function updateAnime(animeId, el) {
  const progress = Number(el.querySelector(".progress").value);
  const status = el.querySelector(".status").value;

  myAnimeList = myAnimeList.map((anime) => {
    if (anime.anime_id !== animeId) {
      return anime;
    }

    return {
      ...anime,
      progress,
      status,
      updated_at: new Date().toISOString(),
    };
  });

  saveLocalList();
  renderList(myAnimeList);
  updateStats(myAnimeList);
}

function removeAnime(animeId) {
  myAnimeList = myAnimeList.filter((anime) => anime.anime_id !== animeId);
  saveLocalList();
  renderList(myAnimeList);
  updateStats(myAnimeList);
}

function updateStats(list) {
  const total = list.length;
  const watching = list.filter((anime) => anime.status === "Watching").length;
  const completed = list.filter((anime) => anime.status === "Completed").length;
  const progress = list.reduce((sum, anime) => sum + Number(anime.progress || 0), 0);

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-watching").textContent = watching;
  document.getElementById("stat-completed").textContent = completed;
  document.getElementById("stat-progress").textContent = progress;
}

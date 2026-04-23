import { supabase } from "./supabase.js";

let user = null;
let myAnimeList = [];

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-btn");
const authMessage = document.getElementById("auth-message");
const userEmail = document.getElementById("user-email");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");

function msg(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#f87171" : "#93c5fd";
}

loginBtn.onclick = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value,
  });

  if (error) {
    return msg(error.message, true);
  }

  user = data.user;
  startApp();
  msg("Logged in");
};

signupBtn.onclick = async () => {
  const { error } = await supabase.auth.signUp({
    email: emailInput.value,
    password: passwordInput.value,
  });

  if (error) {
    return msg(error.message, true);
  }

  msg("Account created. Check email if required.");
};

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.reload();
};

statusFilter.onchange = () => renderList(myAnimeList);

document.getElementById("search-btn").onclick = () => searchAnime();
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchAnime();
  }
});

async function startApp() {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  userEmail.textContent = user.email;
  await loadList();
}

async function loadUser() {
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    user = data.user;
    startApp();
  }
}

loadUser();

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
    const el = document.createElement("div");
    el.className = "anime-card";
    el.innerHTML = `<img src="${anime.coverImage.large}" alt="${anime.title.romaji}"><div class="anime-card-content"><h3>${anime.title.romaji}</h3><button>Add</button></div>`;
    el.querySelector("button").onclick = () => addAnime(anime);
    searchResults.appendChild(el);
  });
}

async function addAnime(anime) {
  await supabase.from("anime_list").upsert({
    user_id: user.id,
    anime_id: anime.id,
    title: anime.title.romaji,
    cover_image: anime.coverImage.large,
    episodes_total: anime.episodes || 0,
    progress: 0,
    status: "Planning",
  });

  await loadList();
}

async function loadList() {
  const { data } = await supabase
    .from("anime_list")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false, nullsFirst: false });

  myAnimeList = data || [];
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

    el.querySelector(".save").onclick = () => updateAnime(anime, el);
    el.querySelector(".remove").onclick = () => removeAnime(anime);

    myList.appendChild(el);
  });
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

async function updateAnime(anime, el) {
  const progress = Number(el.querySelector(".progress").value);
  const status = el.querySelector(".status").value;

  await supabase
    .from("anime_list")
    .update({ progress, status })
    .eq("anime_id", anime.anime_id)
    .eq("user_id", user.id);

  await loadList();
}

async function removeAnime(anime) {
  await supabase
    .from("anime_list")
    .delete()
    .eq("anime_id", anime.anime_id)
    .eq("user_id", user.id);

  await loadList();
}

import { supabase } from "./supabase.js";

let user = null;

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const searchBtn = document.getElementById("search-btn");
const searchInput = document.getElementById("search-input");

const searchResults = document.getElementById("search-results");
const myList = document.getElementById("my-list");

loginBtn.onclick = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });

  if (error) return alert(error.message);

  user = data.user;
  startApp();
};

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.reload();
};

async function startApp() {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");

  loadList();
}

async function loadUser() {
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    user = data.user;
    startApp();
  }
}
loadUser();

searchBtn.onclick = async () => {
  const query = searchInput.value;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
      query ($search: String) {
        Page {
          media(search: $search, type: ANIME) {
            id
            episodes
            title { romaji }
            coverImage { large }
          }
        }
      }`,
      variables: { search: query }
    })
  });

  const data = await res.json();
  renderSearch(data.data.Page.media);
};

function renderSearch(list) {
  searchResults.innerHTML = "";

  list.forEach(a => {
    const el = document.createElement("div");
    el.className = "anime-card";

    el.innerHTML = `
      <img src="${a.coverImage.large}">
      <div class="anime-card-content">
        <h3>${a.title.romaji}</h3>
        <button>Add</button>
      </div>
    `;

    el.querySelector("button").onclick = () => addAnime(a);
    searchResults.appendChild(el);
  });
}

async function addAnime(a) {
  await supabase.from("anime_list").upsert({
    user_id: user.id,
    anime_id: a.id,
    title: a.title.romaji,
    cover_image: a.coverImage.large,
    episodes_total: a.episodes || 0,
    progress: 0,
    status: "Planning"
  });

  loadList();
}

async function loadList() {
  const { data } = await supabase
    .from("anime_list")
    .select("*")
    .eq("user_id", user.id);

  renderList(data);
}

function renderList(list) {
  myList.innerHTML = "";

  list.forEach(a => {
    const el = document.createElement("div");
    el.className = "anime-card";

    el.innerHTML = `
      <img src="${a.cover_image}">
      <div class="anime-card-content">
        <h3>${a.title}</h3>

        <input type="number" value="${a.progress}" class="progress">
        <button class="plus">+1</button>

        <select class="status">
          <option ${a.status==="Planning"?"selected":""}>Planning</option>
          <option ${a.status==="Watching"?"selected":""}>Watching</option>
          <option ${a.status==="Completed"?"selected":""}>Completed</option>
        </select>

        <button class="save">Save</button>
      </div>
    `;

    el.querySelector(".plus").onclick = () => {
      const input = el.querySelector(".progress");
      input.value = Number(input.value) + 1;
    };

    el.querySelector(".save").onclick = () => updateAnime(a, el);

    myList.appendChild(el);
  });
}

async function updateAnime(a, el) {
  const progress = el.querySelector(".progress").value;
  const status = el.querySelector(".status").value;

  await supabase
    .from("anime_list")
    .update({ progress, status })
    .eq("anime_id", a.anime_id)
    .eq("user_id", user.id);

  loadList();
}

// VNTIER Website Script

const $ = (id) => document.getElementById(id);

let players = [];
let loggedIn = false;

const modes = ["Sword", "Axe", "Crystal", "UHC", "SMP", "Pot"];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Có lỗi xảy ra.");
  }

  return result;
}

function renderPlayers() {
  const mode = $("mode").value;
  const search = $("search").value.trim().toLowerCase();

  const tierOrder = [
    "HT1", "HT2", "HT3", "HT4", "HT5",
    "MT1", "MT2", "MT3", "MT4", "MT5",
    "LT1", "LT2", "LT3", "LT4", "LT5"
  ];

  const filtered = players
    .filter(player => {
      const name = String(player.name || "").toLowerCase();
      return name.includes(search);
    })
    .filter(player => player.tiers && player.tiers[mode])
    .sort((a, b) => {
      return tierOrder.indexOf(a.tiers[mode]) -
             tierOrder.indexOf(b.tiers[mode]);
    });

  $("rows").innerHTML = filtered.length
    ? filtered.map((player, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(player.name)}</td>
          <td><strong>${escapeHTML(player.tiers[mode])}</strong></td>
          <td>${escapeHTML(player.discord || "—")}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="4">Chưa có dữ liệu người chơi.</td></tr>`;
}

async function loadPlayers() {
  try {
    const data = await api("/api/public");
    players = data.players || [];
    renderPlayers();
  } catch (error) {
    $("rows").innerHTML =
      `<tr><td colspan="4">Không thể tải dữ liệu.</td></tr>`;
  }
}

$("search").addEventListener("input", renderPlayers);
$("mode").addEventListener("change", renderPlayers);

$("loginOpen").addEventListener("click", () => {
  $("modal").classList.remove("hidden");
});

$("close").addEventListener("click", () => {
  $("modal").classList.add("hidden");
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  $("loginMsg").textContent = "Đang đăng nhập...";

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        password: $("password").value
      })
    });

    loggedIn = true;
    $("loginForm").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
    $("loginMsg").textContent = "Đăng nhập thành công!";
    $("password").value = "";
  } catch (error) {
    $("loginMsg").textContent = "Sai mật khẩu hoặc có lỗi kết nối.";
  }
});

$("addForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!loggedIn) return;

  const name = $("playerName").value.trim();
  const discord = $("discord").value.trim();
  const tier = $("playerTier").value;
  const mode = $("mode").value;

  if (!name) return;

  try {
    await api("/api/admin/players", {
      method: "POST",
      body: JSON.stringify({
        name,
        discord,
        tiers: {
          [mode]: tier
        }
      })
    });

    $("playerName").value = "";
    $("discord").value = "";

    await loadPlayers();
    alert("Đã thêm người chơi thành công!");
  } catch (error) {
    alert(error.message);
  }
});

$("logout").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (error) {
    // Tiếp tục đóng phiên ở giao diện.
  }

  loggedIn = false;
  $("adminPanel").classList.add("hidden");
  $("loginForm").classList.remove("hidden");
  $("loginMsg").textContent = "Đã đăng xuất.";
});

loadPlayers();

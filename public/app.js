
// VNTIER Website Script

const $ = (id) => document.getElementById(id);

let players = [];
let loggedIn = false;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
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

// Tạo giao diện nút xoá
function addDeleteStyle() {
  if ($("deleteStyle")) return;

  const style = document.createElement("style");
  style.id = "deleteStyle";

  style.textContent = `
    .delete-player-btn {
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 13px;
      font-weight: bold;
      cursor: pointer;
    }

    .delete-player-btn:hover {
      background: #991b1b;
    }

    .delete-player-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(style);
}

// Cập nhật tiêu đề bảng
function updateTableHeader() {
  const header = document.querySelector("table thead tr");
  if (!header) return;

  let actionHeader = $("adminActionHeader");

  if (loggedIn && !actionHeader) {
    actionHeader = document.createElement("th");
    actionHeader.id = "adminActionHeader";
    actionHeader.textContent = "ACTION";
    header.appendChild(actionHeader);
  }

  if (!loggedIn && actionHeader) {
    actionHeader.remove();
  }
}

// Hiển thị danh sách player
function renderPlayers() {
  const mode = $("mode").value;
  const search = $("search").value.trim().toLowerCase();

  const tierOrder = [
    "HT1", "HT2", "HT3", "HT4", "HT5",
    "MT1", "MT2", "MT3", "MT4", "MT5",
    "LT1", "LT2", "LT3", "LT4", "LT5"
  ];

  const filtered = players
    .filter(player =>
      String(player.name || "").toLowerCase().includes(search)
    )
    .filter(player => player.tiers && player.tiers[mode])
    .sort((a, b) =>
      tierOrder.indexOf(a.tiers[mode]) -
      tierOrder.indexOf(b.tiers[mode])
    );

  updateTableHeader();

  $("rows").innerHTML = filtered.length
    ? filtered.map((player, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(player.name)}</td>
          <td>
            <strong>${escapeHTML(player.tiers[mode])}</strong>
          </td>
          <td>${escapeHTML(player.discord || "—")}</td>
          ${
            loggedIn
              ? `<td>
                  <button
                    class="delete-player-btn"
                    data-delete-id="${escapeHTML(player.id)}"
                    data-player-name="${escapeHTML(player.name)}"
                  >
                    XOÁ
                  </button>
                </td>`
              : ""
          }
        </tr>
      `).join("")
    : `<tr>
        <td colspan="${loggedIn ? 5 : 4}">
          Chưa có dữ liệu người chơi.
        </td>
      </tr>`;
}

// Tải danh sách player
async function loadPlayers() {
  try {
    const data = await api("/api/public");
    players = data.players || [];
    renderPlayers();
  } catch (error) {
    $("rows").innerHTML =
      `<tr><td colspan="5">Không thể tải dữ liệu.</td></tr>`;
  }
}

// Xoá player
async function deletePlayer(id, name, button) {
  if (!loggedIn) {
    alert("Bạn cần đăng nhập Admin!");
    return;
  }

  const confirmed = confirm(
    `Bạn có chắc chắn muốn xoá ${name} không?\n\nDữ liệu sẽ bị xoá khỏi database!`
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "ĐANG XOÁ...";

  try {
    await api(
      `/api/admin/players/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    await loadPlayers();

    alert(`Đã xoá ${name} thành công!`);
  } catch (error) {
    button.disabled = false;
    button.textContent = "XOÁ";
    alert("Lỗi: " + error.message);
  }
}

// Bắt sự kiện nút xoá
$("rows").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-id]");

  if (!button) return;

  deletePlayer(
    button.dataset.deleteId,
    button.dataset.playerName,
    button
  );
});

// Tìm kiếm
$("search").addEventListener("input", renderPlayers);

// Chọn mode
$("mode").addEventListener("change", renderPlayers);

// Mở cửa sổ đăng nhập
$("loginOpen").addEventListener("click", () => {
  $("modal").classList.remove("hidden");
});

// Đóng cửa sổ đăng nhập
$("close").addEventListener("click", () => {
  $("modal").classList.add("hidden");
});

// Đăng nhập Admin
$("loginForm").addEventListener("submit", async event => {
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

    addDeleteStyle();
    renderPlayers();

  } catch (error) {
    $("loginMsg").textContent =
      "Sai mật khẩu hoặc có lỗi kết nối.";
  }
});

// Thêm player
$("addForm").addEventListener("submit", async event => {
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

    alert("Đã thêm player thành công!");

  } catch (error) {
    alert(error.message);
  }
});

// Đăng xuất
$("logout").addEventListener("click", async () => {
  try {
    await api("/api/logout", {
      method: "POST"
    });
  } catch (error) {
    console.error(error);
  }

  loggedIn = false;

  $("adminPanel").classList.add("hidden");
  $("loginForm").classList.remove("hidden");
  $("loginMsg").textContent = "Đã đăng xuất.";

  renderPlayers();
});

// Khởi chạy
addDeleteStyle();
loadPlayers();

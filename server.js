
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

const PUBLIC_DIR = path.join(__dirname, "public");

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const tiers = [
  "LT5", "LT4", "LT3", "LT2", "LT1",
  "MT5", "MT4", "MT3", "MT2", "MT1",
  "HT5", "HT4", "HT3", "HT2", "HT1"
];

const modes = ["Sword", "Axe", "Crystal", "UHC", "SMP", "Pot"];
const sessions = new Map();

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name VARCHAR(24) NOT NULL,
      discord VARCHAR(64) DEFAULT '',
      tiers JSONB DEFAULT '{}'::jsonb
    )
  `);

  console.log("Neon database connected.");
}

function send(res, status, body, type = "application/json; charset=utf-8", headers = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...headers
  });

  res.end(type.startsWith("application/json")
    ? JSON.stringify(body)
    : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", chunk => {
      raw += chunk;

      if (raw.length > 100000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function isAdmin(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/vntier_session=([a-f0-9]+)/);

  return !!match && sessions.has(match[1]);
}

function safePlayer(p) {
  return {
    id: p.id,
    name: p.name,
    discord: p.discord || "",
    tiers: p.tiers || {}
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  try {
    if (url.pathname === "/api/public" && req.method === "GET") {
      const result = await pool.query(
        "SELECT id, name, discord, tiers FROM players ORDER BY name ASC"
      );

      return send(res, 200, {
        players: result.rows.map(safePlayer),
        tiers,
        modes
      });
    }

    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);

      if (body.password !== ADMIN_PASSWORD) {
        return send(res, 401, { error: "Sai mật khẩu" });
      }

      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, true);

      return send(res, 200, { ok: true },
        "application/json; charset=utf-8", {
          "Set-Cookie":
            `vntier_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400; Secure`
        });
    }

    if (url.pathname === "/api/logout" && req.method === "POST") {
      const match = (req.headers.cookie || "")
        .match(/vntier_session=([a-f0-9]+)/);

      if (match) sessions.delete(match[1]);

      return send(res, 200, { ok: true },
        "application/json; charset=utf-8", {
          "Set-Cookie":
            "vntier_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure"
        });
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!isAdmin(req)) {
        return send(res, 401, {
          error: "Bạn cần đăng nhập admin"
        });
      }

      if (url.pathname === "/api/admin/players" && req.method === "POST") {
        const b = await readBody(req);
        const name = String(b.name || "").trim().slice(0, 24);

        if (!/^[\w. -]{2,24}$/.test(name)) {
          return send(res, 400, {
            error: "Tên người chơi không hợp lệ"
          });
        }

        const player = {
          id: crypto.randomUUID(),
          name,
          discord: String(b.discord || "").slice(0, 64),
          tiers: {}
        };

        for (const mode of modes) {
          if (tiers.includes(b.tiers?.[mode])) {
            player.tiers[mode] = b.tiers[mode];
          }
        }

        await pool.query(
          `INSERT INTO players (id, name, discord, tiers)
           VALUES ($1, $2, $3, $4)`,
          [player.id, player.name, player.discord,
           JSON.stringify(player.tiers)]
        );

        return send(res, 201, safePlayer(player));
      }

      const match = url.pathname.match(
        /^\/api\/admin\/players\/([^/]+)$/
      );

      if (match && req.method === "PUT") {
        const result = await pool.query(
          "SELECT * FROM players WHERE id = $1",
          [match[1]]
        );

        if (!result.rows.length) {
          return send(res, 404, {
            error: "Không tìm thấy người chơi"
          });
        }

        const p = result.rows[0];
        const b = await readBody(req);

        const name = b.name !== undefined
          ? String(b.name).trim().slice(0, 24)
          : p.name;

        const discord = b.discord !== undefined
          ? String(b.discord).slice(0, 64)
          : p.discord;

        const playerTiers = p.tiers || {};

        if (b.mode && modes.includes(b.mode)) {
          if (tiers.includes(b.tier)) {
            playerTiers[b.mode] = b.tier;
          } else {
            delete playerTiers[b.mode];
          }
        }

        const updated = await pool.query(
          `UPDATE players
           SET name = $1, discord = $2, tiers = $3
           WHERE id = $4
           RETURNING *`,
          [name, discord, JSON.stringify(playerTiers), match[1]]
        );

        return send(res, 200, safePlayer(updated.rows[0]));
      }

      if (match && req.method === "DELETE") {
        await pool.query(
          "DELETE FROM players WHERE id = $1",
          [match[1]]
        );

        return send(res, 200, { ok: true });
      }

      return send(res, 404, { error: "Not found" });
    }

    const requested = url.pathname === "/"
      ? "index.html"
      : decodeURIComponent(url.pathname.slice(1));

    const file = path.resolve(PUBLIC_DIR, requested);

    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
      return send(res, 403, "Forbidden", "text/plain");
    }

    fs.readFile(file, (err, content) => {
      if (err) {
        return send(res, 404, "Not found", "text/plain");
      }

      const ext = path.extname(file);

      const type = ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".css"
        ? "text/css; charset=utf-8"
        : ext === ".js"
        ? "text/javascript; charset=utf-8"
        : "application/octet-stream";

      send(res, 200, content, type);
    });

  } catch (error) {
    console.error(error);
    send(res, 500, { error: "Lỗi máy chủ" });
  }
});

async function start() {
  await initDatabase();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`VNTIER running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error("Database startup failed:", error);
  process.exit(1);
});

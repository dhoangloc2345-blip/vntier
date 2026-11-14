const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("Set ADMIN_PASSWORD to a unique password of at least 12 characters.");
  process.exit(1);
}

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { players: [] }; }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
let data = loadData();
const sessions = new Map();
const tiers = ["LT5","LT4","LT3","LT2","LT1","MT5","MT4","MT3","MT2","MT1","HT5","HT4","HT3","HT2","HT1"];
const modes = ["Sword","Axe","Crystal","UHC","SMP","Pot"];

function send(res, status, body, type="application/json; charset=utf-8", headers={}) {
  res.writeHead(status, {"Content-Type": type, "X-Content-Type-Options":"nosniff", "Cache-Control":"no-store", ...headers});
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 100000) reject(new Error("Body too large")); });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
function isAdmin(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/vntier_session=([a-f0-9]+)/);
  return !!match && sessions.has(match[1]);
}
function safePlayer(p) {
  return { id:p.id, name:p.name, discord:p.discord || "", tiers:p.tiers || {} };
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/public" && req.method === "GET") {
      return send(res, 200, {players:data.players.map(safePlayer), tiers, modes});
    }
    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      if (body.password !== ADMIN_PASSWORD) return send(res, 401, {error:"Sai mật khẩu"});
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, true);
      return send(res, 200, {ok:true}, "application/json; charset=utf-8", {
        "Set-Cookie":`vntier_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
      });
    }
    if (url.pathname === "/api/logout" && req.method === "POST") {
      const m = (req.headers.cookie || "").match(/vntier_session=([a-f0-9]+)/);
      if (m) sessions.delete(m[1]);
      return send(res, 200, {ok:true}, "application/json; charset=utf-8", {"Set-Cookie":"vntier_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"});
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (!isAdmin(req)) return send(res, 401, {error:"Bạn cần đăng nhập admin"});
      if (url.pathname === "/api/admin/players" && req.method === "POST") {
        const b = await readBody(req);
        const name = String(b.name || "").trim().slice(0,24);
        if (!/^[\w. -]{2,24}$/.test(name)) return send(res, 400, {error:"Tên người chơi không hợp lệ"});
        const player = {id:crypto.randomUUID(), name, discord:String(b.discord || "").slice(0,64), tiers:{}};
        for (const mode of modes) if (tiers.includes(b.tiers?.[mode])) player.tiers[mode] = b.tiers[mode];
        data.players.push(player); saveData(data);
        return send(res, 201, safePlayer(player));
      }
      const match = url.pathname.match(/^\/api\/admin\/players\/([^/]+)$/);
      if (match && req.method === "PUT") {
        const p = data.players.find(x => x.id === match[1]);
        if (!p) return send(res, 404, {error:"Không tìm thấy người chơi"});
        const b = await readBody(req);
        if (b.name !== undefined) p.name = String(b.name).trim().slice(0,24);
        if (b.discord !== undefined) p.discord = String(b.discord).slice(0,64);
        if (b.mode && modes.includes(b.mode)) {
          if (tiers.includes(b.tier)) p.tiers[b.mode] = b.tier;
          else delete p.tiers[b.mode];
        }
        saveData(data); return send(res, 200, safePlayer(p));
      }
      if (match && req.method === "DELETE") {
        data.players = data.players.filter(x => x.id !== match[1]); saveData(data);
        return send(res, 200, {ok:true});
      }
      return send(res, 404, {error:"Not found"});
    }
    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(PUBLIC_DIR, requested);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Forbidden", "text/plain");
    fs.readFile(file, (err, content) => {
      if (err) return send(res, 404, "Not found", "text/plain");
      const ext = path.extname(file);
      const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : "application/octet-stream";
      send(res, 200, content, type);
    });
  } catch (e) { send(res, 400, {error:e.message || "Bad request"}); }
});
server.listen(PORT, "0.0.0.0", () => console.log(`VNTIER running on port ${PORT}`));

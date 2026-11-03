/* WRONGSIDE online server: serves the game AND runs the rooms (Socket.IO). */
const http = require("http"), fs = require("fs"), path = require("path");
const MAXP = 8, CH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function attach(io) {
  const rooms = new Map();
  const code = () => { let c; do { c = Array.from({ length: 5 }, () => CH[Math.random() * CH.length | 0]).join(""); } while (rooms.has(c)); return c; };
  const clean = s => String(s || "").replace(/[^\w \-]/g, "").trim().slice(0, 12) || "PLAYER";
  const info = r => ({ code: r.code, name: r.name, players: r.p.size, max: MAXP });
  function leave(s) {
    const c = s.data.room; if (!c) return; s.data.room = null; s.leave(c);
    const r = rooms.get(c); if (!r) return; r.p.delete(s.id); s.to(c).emit("pl", s.id); if (!r.p.size) rooms.delete(c);
  }
  function join(s, r, name, cb) {
    if (r.p.size >= MAXP) return cb({ ok: false, err: "ROOM FULL" });
    const others = [...r.p].map(([id, p]) => ({ id, name: p.name }));
    r.p.set(s.id, { name: clean(name), st: null }); s.join(r.code); s.data.room = r.code;
    s.to(r.code).emit("pj", { id: s.id, name: clean(name) });
    cb({ ok: true, code: r.code, seed: r.seed, players: others });
  }
  io.on("connection", s => {
    s.data = s.data || {};
    s.on("rooms", cb => { if (typeof cb === "function") cb([...rooms.values()].filter(r => r.p.size < MAXP).map(info)); });
    s.on("room:create", (d, cb) => {
      if (typeof cb !== "function") return; leave(s); const c = code();
      const r = { code: c, name: clean(d && d.name) + "'S ROOM", seed: Math.random() * 4294967296 >>> 0, p: new Map() }; rooms.set(c, r); join(s, r, d && d.name, cb);
    });
    s.on("room:join", (d, cb) => {
      if (typeof cb !== "function") return; const c = String(d && d.code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); const r = rooms.get(c);
      if (!r) return cb({ ok: false, err: "ROOM NOT FOUND" }); if (s.data.room === c) return cb({ ok: true, code: c, seed: r.seed, players: [...r.p].filter(([id]) => id !== s.id).map(([id, p]) => ({ id, name: p.name })) });
      leave(s); join(s, r, d && d.name, cb);
    });
    s.on("room:leave", () => leave(s));
    s.on("st", a => { const r = rooms.get(s.data.room), p = r && r.p.get(s.id); if (p && Array.isArray(a) && a.length === 5 && a.every(Number.isFinite)) p.st = a; });
    s.on("door", a => { if (s.data.room && Array.isArray(a) && Number.isInteger(a[0]) && a[0] >= 0 && a[0] < 64) s.to(s.data.room).emit("door", [a[0], a[1] ? 1 : 0]); });
    s.on("disconnect", () => leave(s));
  });
  return setInterval(() => {
    for (const r of rooms.values()) { if (r.p.size < 2) continue; const o = {}; r.p.forEach((p, id) => { if (p.st) o[id] = p.st; }); io.to(r.code).emit("snap", o); }
  }, 66);
}
module.exports = { attach };
if (require.main === module) {
  const { Server } = require("socket.io"), FILE = path.join(__dirname, "public", "index.html");
  const srv = http.createServer((req, res) => {
    if (req.url === "/health") { res.end("ok"); return; }
    fs.readFile(FILE, (e, d) => { if (e) { res.writeHead(500); res.end("Put the game file at public/index.html"); return; } res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }); res.end(d); });
  });
  attach(new Server(srv, { cors: { origin: "*" } }));
  const PORT = process.env.PORT || 3000; srv.listen(PORT, () => console.log("WRONGSIDE server on http://localhost:" + PORT));
}

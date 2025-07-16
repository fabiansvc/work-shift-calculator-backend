import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "shifts.csv");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      "id,entry,exit,RDO,RNO,RDDF,RNDF,HEDO,HENO,HEDDF,HENDF,rate\n",
      "utf8"
    );
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\n+/).slice(1); // skip header
  return lines.map((line) => {
    const [
      id,
      entry,
      exit,
      RDO,
      RNO,
      RDDF,
      RNDF,
      HEDO,
      HENO,
      HEDDF,
      HENDF,
      rate,
    ] = line.split(",");
    return {
      id: Number(id),
      entry,
      exit,
      breakdown: {
        RDO: Number(RDO),
        RNO: Number(RNO),
        RDDF: Number(RDDF),
        RNDF: Number(RNDF),
        HEDO: Number(HEDO),
        HENO: Number(HENO),
        HEDDF: Number(HEDDF),
        HENDF: Number(HENDF),
      },
      rate: Number(rate),
    };
  });
}

function toCsv(rows) {
  const header = "id,entry,exit,RDO,RNO,RDDF,RNDF,HEDO,HENO,HEDDF,HENDF,rate";
  const lines = rows.map((r) =>
    [
      r.id,
      r.entry,
      r.exit,
      r.breakdown.RDO,
      r.breakdown.RNO,
      r.breakdown.RDDF,
      r.breakdown.RNDF,
      r.breakdown.HEDO,
      r.breakdown.HENO,
      r.breakdown.HEDDF,
      r.breakdown.HENDF,
      r.rate,
    ].join(",")
  );
  return header + "\n" + lines.join("\n");
}

function readRows() {
  ensureDataFile();
  const text = fs.readFileSync(DATA_FILE, "utf8");
  if (!text.trim()) return [];
  return parseCsv(text);
}

function writeRows(rows) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, toCsv(rows), "utf8");
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "", `http://${req.headers.host}`);

  if (url.pathname === "/api/shifts" && req.method === "GET") {
    const rows = readRows();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(rows));
    return;
  }
  if (url.pathname === "/api/shifts" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const row = JSON.parse(body);
      const rows = readRows();
      row.id = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
      rows.push(row);
      writeRows(rows);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(row));
    });
    return;
  }
  if (url.pathname.startsWith("/api/shifts/") && req.method === "PUT") {
    const id = Number(url.pathname.split("/").pop());
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const updated = JSON.parse(body);
      const rows = readRows();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx !== -1) {
        rows[idx] = { ...updated, id };
        writeRows(rows);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(rows[idx]));
      } else {
        res.statusCode = 404;
        res.end("Not found");
      }
    });
    return;
  }
  if (url.pathname.startsWith("/api/shifts/") && req.method === "DELETE") {
    const id = Number(url.pathname.split("/").pop());
    const rows = readRows();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      rows.splice(idx, 1);
      writeRows(rows);
      res.statusCode = 204;
      res.end();
    } else {
      res.statusCode = 404;
      res.end("Not found");
    }
    return;
  }
  res.statusCode = 404;
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

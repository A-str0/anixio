import * as http from "http";
import { getRouter } from "stremio-addon-sdk";
import { addonInterface } from "./addon";
import { rewriteManifest } from "./play";

const port = parseInt(process.env.PORT || "7000", 10);
const router = getRouter(addonInterface);

function setCors(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
}

function getQueryParam(req: http.IncomingMessage, name: string): string | null {
  try {
    return new URL(req.url || "/", "http://localhost").searchParams.get(name);
  } catch {
    return null;
  }
}

async function handlePlay(req: http.IncomingMessage, res: http.ServerResponse) {
  setCors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    const m = getQueryParam(req, "m");
    if (!m) { res.writeHead(400); return res.end(JSON.stringify({ err: "missing m" })); }

    let data;
    try { data = JSON.parse(Buffer.from(m, "base64url").toString("utf-8")); }
    catch { res.writeHead(400); return res.end(JSON.stringify({ err: "invalid m" })); }

    if (!data.url) { res.writeHead(400); return res.end(JSON.stringify({ err: "no url" })); }

    const resp = await fetch(data.url);
    if (!resp.ok) { res.writeHead(502); return res.end(JSON.stringify({ err: "unreachable" })); }

    const content = await resp.text();
    const baseUrl = data.url.substring(0, data.url.lastIndexOf("/") + 1);
    const rewritten = rewriteManifest(content, baseUrl);

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.end(rewritten);
  } catch (e: any) {
    res.writeHead(500);
    res.end(JSON.stringify({ err: e.message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/play")) return handlePlay(req, res);

  router(req, res, () => {
    res.writeHead(404);
    res.end(JSON.stringify({ err: "not found" }));
  });
});

server.listen(port, () => {
  console.log(`Anixio addon running at http://localhost:${port}/manifest.json`);
});

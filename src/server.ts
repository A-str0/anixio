import * as http from "http";
import { getRouter } from "stremio-addon-sdk";
import { addonInterface } from "./addon";
import { rewriteManifest, proxySegments } from "./play";

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

    const isProxied = data.type === "libria";
    const rewritten = isProxied ? proxySegments(content, baseUrl) : rewriteManifest(content, baseUrl);

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.end(rewritten);
  } catch (e: any) {
    res.writeHead(500);
    res.end(JSON.stringify({ err: e.message }));
  }
}

async function handleSeg(req: http.IncomingMessage, res: http.ServerResponse) {
  setCors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    const targetUrl = getQueryParam(req, "url");
    if (!targetUrl) { res.writeHead(400); return res.end("missing url"); }

    const resp = await fetch(targetUrl);
    if (!resp.ok) { res.writeHead(502); return res.end("unreachable"); }

    const ct = resp.headers.get("content-type") || "video/mp2t";
    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Length", resp.headers.get("content-length") || "");
    res.setHeader("Cache-Control", "public, max-age=3600");

    const body = await resp.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (e: any) {
    res.writeHead(500);
    res.end(e.message);
  }
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/seg")) return handleSeg(req, res);
  if (req.url?.startsWith("/play")) return handlePlay(req, res);

  router(req, res, () => {
    res.writeHead(404);
    res.end(JSON.stringify({ err: "not found" }));
  });
});

server.listen(port, () => {
  console.log(`Anixio addon running at http://localhost:${port}/manifest.json`);
});

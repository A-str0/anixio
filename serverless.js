const { getRouter } = require("stremio-addon-sdk");
const { addonInterface } = require("./dist/addon");
const { rewriteManifest, proxySegments } = require("./dist/play");

const router = getRouter(addonInterface);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
}

function getQueryParam(req, name) {
  try { return new URL(req.url, "http://localhost").searchParams.get(name); }
  catch { return null; }
}

async function handlePlay(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  try {
    const m = getQueryParam(req, "m");
    if (!m) { res.statusCode = 400; return res.end(JSON.stringify({ err: "missing m" })); }
    let data;
    try { data = JSON.parse(Buffer.from(m, "base64url").toString("utf-8")); }
    catch { res.statusCode = 400; return res.end(JSON.stringify({ err: "invalid m" })); }
    if (!data.url) { res.statusCode = 400; return res.end(JSON.stringify({ err: "no url" })); }
    const resp = await fetch(data.url);
    if (!resp.ok) { res.statusCode = 502; return res.end(JSON.stringify({ err: "unreachable" })); }
    const content = await resp.text();
    const baseUrl = data.url.substring(0, data.url.lastIndexOf("/") + 1);
    const isProxied = data.type === "libria";
    const rewritten = isProxied ? proxySegments(content, baseUrl) : rewriteManifest(content, baseUrl);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.end(rewritten);
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ err: e.message }));
  }
}

async function handleSeg(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  try {
    const targetUrl = getQueryParam(req, "url");
    if (!targetUrl) { res.statusCode = 400; return res.end("missing url"); }
    const resp = await fetch(targetUrl);
    if (!resp.ok) { res.statusCode = 502; return res.end("unreachable"); }
    res.setHeader("Content-Type", resp.headers.get("content-type") || "video/mp2t");
    res.setHeader("Content-Length", resp.headers.get("content-length") || "");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const body = await resp.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ err: e.message }));
  }
}

module.exports = function (req, res) {
  if (req.url.startsWith("/seg")) return handleSeg(req, res);
  if (req.url.startsWith("/play")) return handlePlay(req, res);
  router(req, res, function () {
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};

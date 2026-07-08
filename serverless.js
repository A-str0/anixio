const { getRouter } = require("stremio-addon-sdk");
const { addonInterface } = require("./dist/addon");
const { rewriteManifest } = require("./dist/play");

const router = getRouter(addonInterface);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
}

function getQueryParam(req, name) {
  try {
    return new URL(req.url, "http://localhost").searchParams.get(name);
  } catch { return null; }
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
    const rewritten = rewriteManifest(content, baseUrl);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.end(rewritten);
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ err: e.message }));
  }
}

module.exports = function (req, res) {
  if (req.url.startsWith("/play")) return handlePlay(req, res);
  router(req, res, function () {
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};

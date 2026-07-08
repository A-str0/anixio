const { getRouter } = require("stremio-addon-sdk");
const { addonInterface } = require("./dist/addon");
const { resolveM3u8Url, rewriteManifest } = require("./dist/play");

const router = getRouter(addonInterface);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
}

function getQueryParam(req, name) {
  try {
    const urlObj = new URL(req.url, "http://localhost");
    return urlObj.searchParams.get(name);
  } catch {
    return null;
  }
}

async function handlePlay(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const src = getQueryParam(req, "src");
    if (!src) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ err: "missing src param" }));
    }

    const decodedSrc = decodeURIComponent(src);
    const m3u8 = await resolveM3u8Url(decodedSrc);
    if (!m3u8) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ err: "failed to resolve stream" }));
    }

    const response = await fetch(m3u8.url);
    if (!response.ok) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ err: "source unreachable" }));
    }

    const m3u8Content = await response.text();
    const rewritten = rewriteManifest(m3u8Content, m3u8.cdnBase);

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.end(rewritten);
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ err: e.message }));
  }
}

module.exports = function (req, res) {
  if (req.url.startsWith("/play")) {
    return handlePlay(req, res);
  }

  router(req, res, function () {
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};

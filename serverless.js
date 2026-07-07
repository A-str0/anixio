const { getRouter } = require("stremio-addon-sdk");
const { addonInterface } = require("./dist/addon");
const url = require("url");
const { resolveM3u8Url, rewriteManifest } = require("./dist/play");

const router = getRouter(addonInterface);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
}

async function handleDebug(req, res) {
  setCors(res);
  try {
    const parsed = url.parse(req.url, true);
    const src = parsed.query.src;
    if (!src) { res.statusCode = 400; return res.end("missing src"); }

    const decodedSrc = decodeURIComponent(src);
    const pageResponse = await fetch(decodedSrc);
    const html = await pageResponse.text();

    const hashMatch = html.match(/\w+\.hash\s=\s'(.*?)';/i);
    const idMatch = html.match(/\w+\.id\s=\s'(.*?)';/i);
    const typeMatch = html.match(/\w+\.type\s=\s'(.*?)';/i);
    const paramsMatch = html.match(/var\surlParams\s=\s'(.*?)';/i);
    const statusMatch = html.match(/<title>(.*?)<\/title>/i);

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      status: pageResponse.status,
      title: statusMatch ? statusMatch[1] : "none",
      length: html.length,
      hasHash: !!hashMatch,
      hasId: !!idMatch,
      hasType: !!typeMatch,
      hasParams: !!paramsMatch,
      snippet: html.substring(0, 500),
    }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ err: e.message }));
  }
}
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const parsed = url.parse(req.url, true);
    const src = parsed.query.src;

    if (!src) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ err: "missing src param" }));
    }

    const decodedSrc = decodeURIComponent(src);

    const m3u8 = await resolveM3u8Url(decodedSrc);
    if (!m3u8) {
      res.statusCode = 500;
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
    console.error("play error:", e.message, e.stack);
    res.statusCode = 500;
    res.end(JSON.stringify({ err: e.message, stack: e.stack }));
  }
}

module.exports = function (req, res) {
  if (req.url.startsWith("/debug-play")) {
    return handleDebug(req, res);
  }
  if (req.url.startsWith("/play")) {
    return handlePlay(req, res);
  }

  router(req, res, function () {
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};

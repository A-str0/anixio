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
    const result = { step1: "ok" };

    // Step 1: fetch player page
    let pageResponse, html;
    try {
      pageResponse = await fetch(decodedSrc);
      html = await pageResponse.text();
      result.step1_status = pageResponse.status;
      result.step1_len = html.length;
    } catch (e) {
      result.step1_error = e.message;
      return res.end(JSON.stringify(result));
    }

    // Step 2: extract video info
    const hashMatch = html.match(/\w+\.hash\s=\s'(.*?)';/i);
    const idMatch = html.match(/\w+\.id\s=\s'(.*?)';/i);
    const typeMatch = html.match(/\w+\.type\s=\s'(.*?)';/i);
    const paramsMatch = html.match(/var\surlParams\s=\s'(.*?)';/i);
    result.has_hash = !!hashMatch;
    result.has_id = !!idMatch;
    result.has_type = !!typeMatch;
    result.has_params = !!paramsMatch;

    if (!hashMatch || !idMatch || !typeMatch || !paramsMatch) {
      result.error = "missing js vars";
      return res.end(JSON.stringify(result));
    }

    const urlParams = JSON.parse(paramsMatch[1]);
    const body = { ...urlParams, type: typeMatch[1], hash: hashMatch[1], id: idMatch[1] };
    result.step2_extracted = { type: typeMatch[1], id: idMatch[1], hash: hashMatch[1].substring(0, 20) + "..." };
    result.step2_params = Object.keys(body);

    // Step 3: call kodik API
    const apiUrl = `https://kodikplayer.com/ftor?${new URLSearchParams(body).toString()}`;
    result.step3_api_url = apiUrl.substring(0, 80) + "...";

    let apiResponse;
    try {
      apiResponse = await fetch(apiUrl, { referrer: "", referrerPolicy: "no-referrer" });
      result.step3_status = apiResponse.status;
      result.step3_content_type = apiResponse.headers.get("content-type");
      const json = await apiResponse.json();
      result.step3_keys = Object.keys(json);
      result.step3_domain = json.domain;
      result.step3_default = json.default;
      result.step3_has_links = !!json.links;
      if (json.links) {
        result.step3_qualities = Object.keys(json.links);
        result.step3_sample_src = json.links["720"]?.[0]?.src?.substring(0, 60);
        result.step3_valid = true;
      }
    } catch (e) {
      result.step3_error = e.message;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result, null, 2));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ err: e.message }));
  }
}

async function handlePlay(req, res) {
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
    console.error("play error:", e.message);
    res.statusCode = 500;
    res.end(JSON.stringify({ err: e.message }));
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

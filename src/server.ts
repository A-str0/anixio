import * as http from "http";
import * as url from "url";
import { getRouter } from "stremio-addon-sdk";
import { addonInterface } from "./addon";
import { resolveM3u8Url, rewriteManifest } from "./play";

const port = parseInt(process.env.PORT || "7000", 10);
const router = getRouter(addonInterface);

function setCors(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
}

async function handlePlay(req: http.IncomingMessage, res: http.ServerResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    const parsed = url.parse(req.url || "", true);
    const src = parsed.query.src as string;

    if (!src) {
      res.writeHead(400);
      return res.end(JSON.stringify({ err: "missing src param" }));
    }

    const decodedSrc = decodeURIComponent(src);
    const m3u8 = await resolveM3u8Url(decodedSrc);

    if (!m3u8) {
      res.writeHead(500);
      return res.end(JSON.stringify({ err: "failed to resolve stream" }));
    }

    const response = await fetch(m3u8.url);
    if (!response.ok) {
      res.writeHead(502);
      return res.end(JSON.stringify({ err: "source unreachable" }));
    }

    const m3u8Content = await response.text();
    const rewritten = rewriteManifest(m3u8Content, m3u8.cdnBase);

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.end(rewritten);
  } catch (e: any) {
    res.writeHead(500);
    res.end(JSON.stringify({ err: e.message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/play")) {
    return handlePlay(req, res);
  }

  router(req, res, () => {
    res.writeHead(404);
    res.end(JSON.stringify({ err: "not found" }));
  });
});

server.listen(port, () => {
  console.log(`Anixio addon running at http://localhost:${port}/manifest.json`);
});

import { AniLibriaParser, SibnetParser } from "anixapi";

interface ResolvedM3u8 {
  url: string;
  cdnBase: string;
}

const QUALITY_ORDER = ["1080", "720", "480", "360", "240"];

async function resolveKodik(sourceUrl: string): Promise<ResolvedM3u8 | null> {
  try {
    const pageResp = await fetch(sourceUrl);
    if (!pageResp.ok) return null;
    const html = await pageResp.text();

    if (html.includes("страницы не существует") || html.includes("page could not be found")) return null;

    const hashMatch = html.match(/(?:hash|videoInfo\.hash)\s*=\s*['"]([^'"]+)['"]/i);
    const idMatch = html.match(/(?:videoId|id|videoInfo\.id)\s*=\s*['"]([^'"]+)['"]/i);
    const paramsMatch = html.match(/(?:var\s+)?urlParams\s*=\s*'([^']*)'/i);

    const videoType = sourceUrl.includes("/seria/") ? "seria" : "movie";

    if (!hashMatch || !idMatch || !paramsMatch) return null;

    let urlParams: Record<string, string>;
    try {
      urlParams = JSON.parse(paramsMatch[1]);
  } catch (e: any) {
    console.error("resolveKodik error:", e.message);
    return null;
  }

    const apiBody: Record<string, string> = {
      ...urlParams,
      type: videoType,
      hash: hashMatch[1],
      id: idMatch[1],
    };

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(apiBody)) {
      params.append(k, v);
    }

    const apiUrl = `https://kodikplayer.com/ftor?${params.toString()}`;
    const apiResp = await fetch(apiUrl, { referrer: "", referrerPolicy: "no-referrer" });
    const json: any = await apiResp.json();

    if (!json.links) return null;

    const links: Record<string, { src: string }[]> = json.links;

    for (const q of QUALITY_ORDER) {
      const sources = links[q];
      if (sources && sources.length > 0) {
        let src = sources[0].src;

        const validUrlPattern = /\/\/(get|cloud)\.(kodik-storage|solodcdn)\.com\/useruploads\/.*?\/.*?\/(240|360|480|720|1080)\.mp4:hls:manifest.m3u8/s;
        const isCdnProxy = src.includes("/s/m/") || src.includes("://");
        if (!validUrlPattern.test(src) && !isCdnProxy) {
          try {
            const decrypted = src.replace(/[a-zA-Z]/g, (e: string) => {
              let code = e.charCodeAt(0);
              code = code + 18;
              if (e <= "Z" && code > 90) code -= 26;
              else if (e >= "a" && code > 122) code -= 26;
              return String.fromCharCode(code);
            });
            src = Buffer.from(decrypted, "base64").toString("utf-8");
          } catch {
            continue;
          }
        }

        const baseUrl = src.substring(0, src.lastIndexOf("/") + 1);
        return { url: src, cdnBase: baseUrl };
      }
    }

    return null;
  } catch (e: any) {
    return null;
  }
}

export async function resolveM3u8Url(sourceUrl: string): Promise<ResolvedM3u8 | null> {
  try {
    if (sourceUrl.includes("sibnet")) {
      const directUrl = await SibnetParser.getDirectLink(sourceUrl);
      if (directUrl) return { url: directUrl, cdnBase: "" };
      return null;
    }

    if (sourceUrl.includes("kodik")) {
      return await resolveKodik(sourceUrl);
    }

    if (sourceUrl.includes("libria") || sourceUrl.includes("anilibria")) {
      const links = await AniLibriaParser.getDirectLinks(sourceUrl);
      if (!links) return null;

      for (const q of QUALITY_ORDER) {
        const source = links[q];
        if (source && source.src) {
          const m3u8Url = source.src;
          const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf("/") + 1);
          return { url: m3u8Url, cdnBase: baseUrl };
        }
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

function unwrapCdnUrl(url: string): string {
  const match = url.match(/^(https?:\/\/[^/]+)\/s\/m\/([A-Za-z0-9+/=]+)\/(.+)$/);
  if (!match) return url;

  try {
    const decoded = Buffer.from(match[2], "base64").toString("utf-8");
    if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
      return `${decoded}/${match[3]}`;
    }
  } catch {}

  return url;
}

export function rewriteManifest(m3u8Content: string, cdnBase: string): string {
  if (!cdnBase) return m3u8Content;

  const lines = m3u8Content.split("\n");
  const rewritten: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") {
      rewritten.push(line);
    } else if (line.startsWith("http://") || line.startsWith("https://")) {
      rewritten.push(unwrapCdnUrl(line));
    } else if (line.startsWith("//")) {
      rewritten.push(unwrapCdnUrl(`https:${line}`));
    } else {
      rewritten.push(new URL(line, cdnBase).toString());
    }
  }

  return rewritten.join("\n");
}

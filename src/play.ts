import { KodikParser, AniLibriaParser, SibnetParser } from "anixapi";

interface ResolvedM3u8 {
  url: string;
  cdnBase: string;
}

const QUALITY_ORDER = ["1080", "720", "480", "360", "240"];

export async function resolveM3u8Url(sourceUrl: string): Promise<ResolvedM3u8 | null> {
  try {
    if (sourceUrl.includes("sibnet")) {
      const directUrl = await SibnetParser.getDirectLink(sourceUrl);
      if (directUrl) return { url: directUrl, cdnBase: "" };
      return null;
    }

    if (sourceUrl.includes("kodik")) {
      const links = await KodikParser.getDirectLinks(sourceUrl);
      if (!links) return null;

      for (const q of QUALITY_ORDER) {
        const sources = links[q];
        if (sources && sources.length > 0) {
          const m3u8Url = sources[0].src;
          const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf("/") + 1);
          return { url: m3u8Url, cdnBase: baseUrl };
        }
      }
      return null;
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

export function rewriteManifest(m3u8Content: string, cdnBase: string): string {
  if (!cdnBase) return m3u8Content;

  const lines = m3u8Content.split("\n");
  const rewritten: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") {
      rewritten.push(line);
    } else if (line.startsWith("http://") || line.startsWith("https://") || line.startsWith("//")) {
      rewritten.push(line);
    } else {
      rewritten.push(new URL(line, cdnBase).toString());
    }
  }

  return rewritten.join("\n");
}

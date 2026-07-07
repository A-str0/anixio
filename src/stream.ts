import { Anixart, SibnetParser } from "anixapi";
import type { ContentType, Stream } from "stremio-addon-sdk";
import { parseAnixartId, parseAnixartEpisodeId } from "./utils";
import { resolveToAnixart } from "./resolve";

const client = new Anixart({});

function needsProxy(url: string): boolean {
  return url.includes("kodik") || url.includes("libria") || url.includes("anilibria");
}

function proxyUrl(src: string): string {
  return `/play?src=${encodeURIComponent(src)}`;
}

async function resolveStream(label: string, url: string): Promise<Stream | null> {
  if (!url) return null;

  if (url.includes("sibnet")) {
    try {
      const directUrl = await SibnetParser.getDirectLink(url);
      if (directUrl) {
        const fixed = directUrl.startsWith("//") ? `https:${directUrl}` : directUrl;
        return { name: "Anixart", title: label, url: fixed };
      }
    } catch {}
  }

  if (needsProxy(url)) {
    return { name: "Anixart", title: label, url: proxyUrl(url) };
  }

  if (url.startsWith("//")) url = `https:${url}`;

  return { name: "Anixart", title: label, url };
}

export async function streamHandler(args: { type: ContentType; id: string }): Promise<{ streams: Stream[] }> {
  let episodeInfo = parseAnixartEpisodeId(args.id);
  let releaseId = episodeInfo?.releaseId ?? parseAnixartId(args.id);

  if (!releaseId) {
    const resolved = await resolveToAnixart(args.type, args.id);
    if (resolved) {
      releaseId = resolved;
      const parsed = args.id.match(/:(\d+):(\d+)$/);
      if (parsed) {
        episodeInfo = {
          releaseId: resolved,
          season: parseInt(parsed[1], 10),
          episode: parseInt(parsed[2], 10),
        };
      }
    }
  }

  if (!releaseId) {
    return { streams: [] };
  }

  try {
    const streams: Stream[] = [];
    const seen = new Set<string>();
    const targetEpisode = episodeInfo?.episode ?? null;

    const typesResult = await client.endpoints.episode.types(releaseId);
    const dubbers = typesResult.types || [];

    for (const dubber of dubbers) {
      if (streams.length >= 200) break;

      let sourcesResult;
      try {
        sourcesResult = await client.endpoints.episode.sources(releaseId, dubber.id);
      } catch {
        continue;
      }

      const sources = sourcesResult.sources || [];

      for (const source of sources) {
        if (streams.length >= 200) break;

        let episodesResult;
        try {
          episodesResult = await client.endpoints.episode.episodes(releaseId, dubber.id, source.id);
        } catch {
          continue;
        }

        const episodes = episodesResult.episodes || [];

        for (const ep of episodes) {
          if (targetEpisode !== null && ep.position !== targetEpisode) continue;
          if (!ep.url) continue;
          if (streams.length >= 200) break;

          const baseLabel = `${dubber.name} | ${source.name}`;
          const labelWithEp = ep.name ? `${baseLabel} — ${ep.name}` : baseLabel;

          const stream = await resolveStream(labelWithEp, ep.url);
          if (!stream) continue;

          const key = stream.url || "";
          if (seen.has(key)) continue;
          seen.add(key);

          streams.push(stream);
        }
      }
    }

    return { streams };
  } catch (err) {
    console.error("Stream error:", err);
    return { streams: [] };
  }
}

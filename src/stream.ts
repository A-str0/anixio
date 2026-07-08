import { Anixart, KodikParser, AniLibriaParser, SibnetParser } from "anixapi";
import type { ContentType, Stream } from "stremio-addon-sdk";
import { parseAnixartId, parseAnixartEpisodeId } from "./utils";
import { resolveToAnixart } from "./resolve";

const client = new Anixart({});

async function resolveDirectM3u8(label: string, url: string): Promise<Stream | null> {
  try {
    if (url.includes("sibnet")) {
      const directUrl = await SibnetParser.getDirectLink(url);
      if (directUrl) return { name: "Anixart", title: label, url: directUrl };
      return null;
    }

    if (url.includes("kodik")) {
      const links = await KodikParser.getDirectLinks(url);
      if (!links) return null;

      for (const q of ["720", "480", "360", "240"]) {
        const sources = links[q];
        if (sources && sources.length > 0) {
          const m3u8Url = sources[0].src;
          const encoded = Buffer.from(JSON.stringify({ url: m3u8Url })).toString("base64url");
          return {
            name: "Anixart",
            title: `${label} (${q}p)`,
            url: `/play?m=${encoded}`,
          };
        }
      }
      return null;
    }

    if (url.includes("libria") || url.includes("anilibria")) {
      const links = await AniLibriaParser.getDirectLinks(url);
      if (!links) return null;

      for (const q of ["1080", "720", "480"]) {
        const source = links[q];
        if (source && source.src) {
          const encoded = Buffer.from(JSON.stringify({ url: source.src })).toString("base64url");
          return {
            name: "Anixart",
            title: `${label} (${q}p)`,
            url: `/play?m=${encoded}`,
          };
        }
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
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

  if (!releaseId) return { streams: [] };

  try {
    const streams: Stream[] = [];
    const seen = new Set<string>();
    const targetEpisode = episodeInfo?.episode ?? null;

    const typesResult = await client.endpoints.episode.types(releaseId);
    const dubbers = typesResult.types || [];

    for (const dubber of dubbers) {
      if (streams.length >= 50) break;

      let sourcesResult;
      try {
        sourcesResult = await client.endpoints.episode.sources(releaseId, dubber.id);
      } catch {
        continue;
      }

      const sources = sourcesResult.sources || [];

      for (const source of sources) {
        if (streams.length >= 50) break;

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
          if (streams.length >= 50) break;

          const baseLabel = `${dubber.name} | ${source.name}`;
          const labelWithEp = ep.name ? `${baseLabel} — ${ep.name}` : baseLabel;

          if (seen.has(ep.url)) continue;
          seen.add(ep.url);

          const resolved = await resolveDirectM3u8(labelWithEp, ep.url);
          if (resolved) {
            streams.push(resolved);
          }
        }
      }
    }

    return { streams };
  } catch (err) {
    console.error("Stream error:", err);
    return { streams: [] };
  }
}

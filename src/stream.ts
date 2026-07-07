import { Anixart, KodikParser, AniLibriaParser, SibnetParser } from "anixapi";
import type { ContentType, Stream } from "stremio-addon-sdk";
import { parseAnixartId, parseAnixartEpisodeId } from "./utils";
import { resolveToAnixart } from "./resolve";

const client = new Anixart({});

interface ResolvedStream {
  title: string;
  url: string;
  quality: number;
}

async function resolveStreamUrl(label: string, url: string): Promise<ResolvedStream[]> {
  const results: ResolvedStream[] = [];

  try {
    if (url.includes("kodik")) {
      const links = await KodikParser.getDirectLinks(url);
      if (links) {
        for (const [quality, sources] of Object.entries(links)) {
          for (const src of sources) {
            results.push({
              title: `${label} (${quality}p)`,
              url: src.src,
              quality: parseInt(quality, 10) || 0,
            });
          }
        }
      }
    } else if (url.includes("anilibria") || url.includes("libria")) {
      const links = await AniLibriaParser.getDirectLinks(url);
      if (links) {
        for (const [quality, src] of Object.entries(links)) {
          results.push({
            title: `${label} (${quality}p)`,
            url: src.src,
            quality: parseInt(quality, 10) || 0,
          });
        }
      }
    } else if (url.includes("sibnet")) {
      const directUrl = await SibnetParser.getDirectLink(url);
      if (directUrl) {
        results.push({ title: label, url: directUrl, quality: 0 });
      }
    }
  } catch {
    // parser failed, try direct URL
  }

  if (results.length === 0) {
    results.push({ title: label, url, quality: 0 });
  }

  results.sort((a, b) => b.quality - a.quality);
  return results;
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

          const resolvedStreams = await resolveStreamUrl(labelWithEp, ep.url);

          const best = resolvedStreams[0];
          if (best && !seen.has(best.url)) {
            seen.add(best.url);
            streams.push({
              name: "Anixart",
              title: best.title,
              url: best.url,
            });
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

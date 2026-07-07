import { Anixart } from "anixapi";
import type { ContentType, Stream } from "stremio-addon-sdk";
import { parseAnixartId, parseAnixartEpisodeId } from "./utils";

const client = new Anixart({});

export async function streamHandler(args: { type: ContentType; id: string }): Promise<{ streams: Stream[] }> {
  const episodeInfo = parseAnixartEpisodeId(args.id);
  const releaseId = episodeInfo?.releaseId ?? parseAnixartId(args.id);

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
          if (!ep.url || seen.has(ep.url)) continue;
          if (streams.length >= 200) break;

          seen.add(ep.url);

          const title = ep.name
            ? `${dubber.name} | ${source.name} — ${ep.name}`
            : `${dubber.name} | ${source.name}`;

          streams.push({
            name: "Anixart",
            title,
            url: ep.url,
          });
        }
      }
    }

    return { streams };
  } catch (err) {
    console.error("Stream error:", err);
    return { streams: [] };
  }
}

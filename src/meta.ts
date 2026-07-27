import { Anixart } from "anixapi";
import type { ContentType, MetaDetail } from "stremio-addon-sdk";
import { toMetaDetail, parseAnixartId, episodeVideoId } from "./utils";
import { resolveToAnixart } from "./resolve";

const client = new Anixart({});

export async function metaHandler(args: { type: ContentType; id: string }) {
  let releaseId = parseAnixartId(args.id);

  if (!releaseId) {
    releaseId = await resolveToAnixart(args.type, args.id);
  }

  if (!releaseId) {
    return { meta: {} as MetaDetail };
  }

  try {
    const result = await client.endpoints.release.release(releaseId);

    if (!result || !result.release) {
      return { meta: {} as MetaDetail };
    }

    const meta = toMetaDetail(result.release);

    const currentSeason = result.release.season || 1;

    let nextRelease: any = null;

    const relatedFromRelease = result.release.related_releases;
    if (relatedFromRelease && relatedFromRelease.length > 1) {
      const others = relatedFromRelease
        .filter((r: any) => r.id !== releaseId)
        .sort((a: any, b: any) => a.id - b.id);
      nextRelease = others.find((r: any) => r.id > releaseId) || others[0];
    }

    if (!nextRelease) {
      try {
        const relatedResp = await client.endpoints.related.related(releaseId, 0);
        const items = relatedResp?.content || [];
        if (items.length > 0) {
          const others = items
            .filter((r: any) => r.id !== releaseId)
            .sort((a: any, b: any) => a.id - b.id);
          nextRelease = others.find((r: any) => r.id > releaseId) || others[0];
        }
      } catch {}
    }

    if (nextRelease && nextRelease.id && meta.videos) {
      const nextSeasonNum = currentSeason + 1;
      const nextEps = nextRelease.episodes_total || 0;

      for (let ep = 1; ep <= nextEps; ep++) {
        meta.videos.push({
          id: episodeVideoId(nextRelease.id, nextSeasonNum, ep),
          title: `Эпизод ${ep}`,
          released: nextRelease.release_date || String(nextRelease.aired_on_date || ""),
          season: nextSeasonNum,
          episode: ep,
        });
      }
    }

    return { meta };
  } catch (err) {
    console.error("Meta error:", err);
    return { meta: {} as MetaDetail };
  }
}

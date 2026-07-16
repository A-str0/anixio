import { Anixart, FilterSortType } from "anixapi";
import type { Args, MetaPreview, ContentType } from "stremio-addon-sdk";
import { posterThumbUrl, anixartId } from "./utils";

const client = new Anixart({});

function releaseTypeToStremio(release: any): ContentType {
  if (release.category?.id === 2) return "movie";
  return "series";
}

function toMetaPreview(release: any): MetaPreview {
  return {
    id: anixartId(release.id),
    type: releaseTypeToStremio(release),
    name: release.title_ru || release.title_original || "",
    poster: posterThumbUrl(release.poster),
    posterShape: "regular" as const,
  };
}

export async function catalogHandler(args: Args) {
  const { type, id, extra } = args;

  if (type !== "series" && type !== "movie") {
    return { metas: [] };
  }

  const skip = extra.skip || 0;
  const page = Math.floor(skip / 30);
  const search = extra.search as string | undefined;

  try {
    if (search) {
      return await searchCatalog(type, search);
    }

    const releases = await fetchAnixartCatalog(id, page);
    return { metas: releases.map(toMetaPreview) };
  } catch (err) {
    console.error("Catalog error:", err);
    return { metas: [] };
  }
}

async function fetchAnixartCatalog(id: string, page: number): Promise<any[]> {
  switch (id) {
    case "anixart_popular":
      return (await client.endpoints.filter.filter(page, { sort: FilterSortType.SortPopular })).content || [];
    case "anixart_ongoing":
      return (await client.endpoints.filter.filter(page, { status_id: 2, sort: FilterSortType.SortPopular })).content || [];
    case "anixart_latest":
      return (await client.endpoints.filter.filter(page, { sort: FilterSortType.SortDateUpdate })).content || [];
    case "anixart_announce":
      return (await client.endpoints.filter.filter(page, { status_id: 3, sort: FilterSortType.SortPopular })).content || [];
    default:
      if (id.startsWith("anixart_genre_")) {
        const genreId = id.replace("anixart_genre_", "");
        return (await client.endpoints.filter.filter(page, { genres: [genreId], sort: FilterSortType.SortPopular })).content || [];
      }
      return [];
  }
}

async function searchCatalog(type: string, query: string) {
  const seen = new Set<number>();
  const releases: any[] = [];

  const addResults = (content: any[]) => {
    for (const r of content) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        releases.push(r);
      }
    }
  };

  const [v2, v1] = await Promise.allSettled([
    (async () => {
      for (let p = 0; p < 2; p++) {
        const r = await client.endpoints.search.releaseSearch(p, { page: p, query, searchBy: 0 });
        if (!r.content || r.content.length === 0) break;
        addResults(r.content);
      }
    })(),
    (async () => {
      for (let p = 0; p < 2; p++) {
        const r = await client.call<any, any>({
          path: `/search/releases/${p}`,
          method: "POST",
          json: { page: p, query, searchBy: 0 },
        });
        if (!r.content || r.content.length === 0) break;
        addResults(r.content);
      }
    })(),
  ]);

  if (v2.status === "rejected" && v1.status === "rejected") {
    return { metas: [] as MetaPreview[] };
  }

  return { metas: releases.map(toMetaPreview) };
}

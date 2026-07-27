import { Anixart, FilterSortType } from "anixapi";
import type { Args, MetaPreview, ContentType } from "stremio-addon-sdk";
import { posterThumbUrl, anixartId } from "./utils";
import { scoreRelease } from "./resolve";

const client = new Anixart({});
const CINEMETA_BASE = "https://v3-cinemeta.strem.io";

function releaseTypeToStremio(release: any): ContentType {
  if (release.category?.id === 2) return "movie";
  return "series";
}

function toMetaPreview(release: any, enrich?: { name?: string; poster?: string }): MetaPreview {
  return {
    id: anixartId(release.id),
    type: releaseTypeToStremio(release),
    name: enrich?.name || release.title_ru || release.title_original || "",
    poster: enrich?.poster || posterThumbUrl(release.poster),
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
    return { metas: releases.map((r) => toMetaPreview(r)) };
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

async function searchAnixartReleases(query: string): Promise<any[]> {
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

  return releases;
}

interface CinemetaMeta {
  id: string;
  name: string;
  poster?: string;
  type?: ContentType;
  releaseInfo?: string;
}

async function searchCinemeta(type: string, query: string): Promise<CinemetaMeta[]> {
  try {
    const url = `${CINEMETA_BASE}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { metas?: CinemetaMeta[] };
    return data.metas || [];
  } catch {
    return [];
  }
}

function matchWithCinemeta(anixartReleases: any[], cinemetaResults: CinemetaMeta[]): MetaPreview[] {
  const used = new Set<string>();
  const enriched: MetaPreview[] = [];

  for (const release of anixartReleases) {
    let bestMatch: CinemetaMeta | null = null;
    let bestScore = 0;

    for (const cm of cinemetaResults) {
      if (used.has(cm.id)) continue;
      const year = cm.releaseInfo ? parseInt(cm.releaseInfo, 10) || null : null;
      const score = scoreRelease(cm.name, release, undefined, year);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cm;
      }
    }

    if (bestMatch && bestScore >= 50) {
      used.add(bestMatch.id);
      enriched.push(toMetaPreview(release, {
        name: bestMatch.name,
        poster: bestMatch.poster,
      }));
    } else {
      enriched.push(toMetaPreview(release));
    }
  }

  return enriched;
}

async function searchCatalog(type: string, query: string) {
  const [anixartResults, cinemetaResults] = await Promise.all([
    searchAnixartReleases(query),
    searchCinemeta(type, query),
  ]);

  if (anixartResults.length === 0 && cinemetaResults.length === 0) {
    return { metas: [] as MetaPreview[] };
  }

  if (anixartResults.length > 0 && cinemetaResults.length > 0) {
    return { metas: matchWithCinemeta(anixartResults, cinemetaResults) };
  }

  if (anixartResults.length > 0) {
    return { metas: anixartResults.map((r) => toMetaPreview(r)) };
  }

  return {
    metas: cinemetaResults.map((cm) => ({
      id: cm.id,
      type: cm.type || (type as ContentType),
      name: cm.name,
      poster: cm.poster,
      posterShape: "regular" as const,
    })) as MetaPreview[],
  };
}

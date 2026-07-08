import { Anixart, FilterSortType } from "anixapi";
import type { Args, MetaPreview } from "stremio-addon-sdk";
import { posterThumbUrl } from "./utils";

const client = new Anixart({});
const CINEMETA = "https://v3-cinemeta.strem.io";

interface CinemetaResult {
  metas: { id: string; name: string; poster?: string; genres?: string[] }[];
}

const idCache = new Map<string, string>();
const cacheTTL = 3600_000;
const cacheTimestamps = new Map<string, number>();

async function resolveImdbId(title: string): Promise<string | null> {
  const cached = idCache.get(title);
  if (cached) {
    const ts = cacheTimestamps.get(title) || 0;
    if (Date.now() - ts < cacheTTL) return cached;
  }

  try {
    const url = `${CINEMETA}/catalog/series/top/search=${encodeURIComponent(title)}.json`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as CinemetaResult;
    if (!data.metas || data.metas.length === 0) return null;

    const imdbId = data.metas[0].id;
    idCache.set(title, imdbId);
    cacheTimestamps.set(title, Date.now());
    return imdbId;
  } catch {
    return null;
  }
}

function releaseTypeToStremio(release: any): string {
  if (release.category?.id === 2) return "movie";
  return "series";
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
    const metas = await Promise.all(
      releases.map(async (r: any) => {
        const searchTitle = r.title_original || r.title_ru;
        const imdbId = await resolveImdbId(searchTitle);

        if (imdbId) {
          return {
            id: imdbId,
            type: releaseTypeToStremio(r),
            name: r.title_ru || r.title_original || "",
            poster: posterThumbUrl(r.poster),
            posterShape: "regular" as const,
          } as MetaPreview;
        }

        return null;
      })
    );

    return { metas: metas.filter(Boolean) as MetaPreview[] };
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
  try {
    const url = `${CINEMETA}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
    const resp = await fetch(url);
    if (!resp.ok) return { metas: [] as MetaPreview[] };
    const data = (await resp.json()) as { metas: MetaPreview[] };
    return { metas: data.metas || [] };
  } catch {
    return { metas: [] as MetaPreview[] };
  }
}

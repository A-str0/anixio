import { Anixart, FilterSortType } from "anixapi";
import type { Args } from "stremio-addon-sdk";
import type { MetaPreview } from "stremio-addon-sdk";
import { fetchJson } from "./fetch";
import { toMetaPreview } from "./utils";

const client = new Anixart({});
const CINEMETA_BASE = "https://v3-cinemeta.strem.io";

interface CinemetaMeta extends MetaPreview {
  genres?: string[];
}

interface CinemetaCatalog {
  metas: CinemetaMeta[];
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
    if (id.startsWith("anixart_")) {
      return await anixartCatalog(id, type, page, search);
    }
    if (id.startsWith("cinemeta_")) {
      return await cinemetaCatalog(id, type, skip, search);
    }
    return { metas: [] };
  } catch (err) {
    console.error("Catalog error:", err);
    return { metas: [] };
  }
}

async function anixartCatalog(
  id: string,
  type: string,
  page: number,
  search: string | undefined
) {
  let releases: any[] = [];

  if (search) {
    const result = await client.endpoints.search.releaseSearch(page, {
      query: search,
      searchBy: 0,
      page: page + 1,
    });
    releases = result.content || [];
  } else {
    switch (id) {
      case "anixart_popular":
        releases = (await client.endpoints.filter.filter(page, { sort: FilterSortType.SortPopular })).content || [];
        break;
      case "anixart_ongoing":
        releases = (await client.endpoints.filter.filter(page, { status_id: 2, sort: FilterSortType.SortPopular })).content || [];
        break;
      case "anixart_latest":
        releases = (await client.endpoints.filter.filter(page, { sort: FilterSortType.SortDateUpdate })).content || [];
        break;
      case "anixart_announce":
        releases = (await client.endpoints.filter.filter(page, { status_id: 3, sort: FilterSortType.SortPopular })).content || [];
        break;
      default:
        if (id.startsWith("anixart_genre_")) {
          const genreId = id.replace("anixart_genre_", "");
          releases = (await client.endpoints.filter.filter(page, { genres: [genreId], sort: FilterSortType.SortPopular })).content || [];
        }
        break;
    }
  }

  const metas = releases.map((r: any) => toMetaPreview(r));
  return { metas };
}

async function cinemetaCatalog(
  id: string,
  type: string,
  skip: number,
  search: string | undefined
) {
  const cinemetaId = id.replace("cinemeta_", "");
  const url = `${CINEMETA_BASE}/catalog/${type}/${cinemetaId}.json?skip=${skip}`;
  const data = await fetchJson<CinemetaCatalog>(url);
  if (!data) return { metas: [] };

  let metas = data.metas || [];

  if (search) {
    const q = search.toLowerCase();
    metas = metas.filter((m) => m.name.toLowerCase().includes(q));
  }

  return { metas };
}

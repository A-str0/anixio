import { Anixart, FilterSortType } from "anixapi";
import type { Args } from "stremio-addon-sdk";
import { toMetaPreview } from "./utils";

const client = new Anixart({});

export async function catalogHandler(args: Args) {
  const { type, id, extra } = args;

  if (type !== "series" && type !== "movie") {
    return { metas: [] };
  }

  const skip = extra.skip || 0;
  const page = Math.floor(skip / 30);
  const search = extra.search as string | undefined;

  try {
    let releases: any[] = [];

    if (search) {
      releases = await searchReleases(search, page);
    } else {
      releases = await fetchCatalog(id, page);
    }

    const metas = releases.map(toMetaPreview);
    return { metas };
  } catch (err) {
    console.error("Catalog error:", err);
    return { metas: [] };
  }
}

async function searchReleases(query: string, page: number) {
  const result = await client.endpoints.search.releaseSearch(page, {
    query,
    searchBy: 0,
    page: page + 1,
  });
  return result.content || [];
}

async function fetchCatalog(id: string, page: number) {
  switch (id) {
    case "anixart_popular": {
      const result = await client.endpoints.filter.filter(page, {
        sort: FilterSortType.SortPopular,
      });
      return result.content || [];
    }
    case "anixart_ongoing": {
      const result = await client.endpoints.filter.filter(page, {
        status_id: 2,
        sort: FilterSortType.SortPopular,
      });
      return result.content || [];
    }
    case "anixart_latest": {
      const result = await client.endpoints.filter.filter(page, {
        sort: FilterSortType.SortDateUpdate,
      });
      return result.content || [];
    }
    case "anixart_announce": {
      const result = await client.endpoints.filter.filter(page, {
        status_id: 3,
        sort: FilterSortType.SortPopular,
      });
      return result.content || [];
    }
    default: {
      if (id.startsWith("anixart_genre_")) {
        const genreId = id.replace("anixart_genre_", "");
        const result = await client.endpoints.filter.filter(page, {
          genres: [genreId],
          sort: FilterSortType.SortPopular,
        });
        return result.content || [];
      }
      return [];
    }
  }
}

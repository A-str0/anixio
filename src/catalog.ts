import type { Args, MetaPreview } from "stremio-addon-sdk";
import { fetchJson } from "./fetch";

const CINEMETA_BASE = "https://v3-cinemeta.strem.io";

interface CinemetaMeta extends MetaPreview {
  genres?: string[];
}

interface CinemetaCatalog {
  metas: CinemetaMeta[];
}

const ANIME_GENRES = new Set([
  "Animation", "Anime", "Action", "Adventure", "Fantasy",
  "Sci-Fi", "Science Fiction", "Horror", "Comedy", "Drama",
  "Romance", "Thriller", "Mystery",
]);

function hasAnimeGenres(genres: string[] | undefined): boolean {
  if (!genres || genres.length === 0) return false;
  return genres.some((g) => ANIME_GENRES.has(g));
}

function filterAnime(metas: CinemetaMeta[]): CinemetaMeta[] {
  return metas.filter((m) => hasAnimeGenres(m.genres));
}

export async function catalogHandler(args: Args) {
  const { type, id, extra } = args;

  if (type !== "series" && type !== "movie") {
    return { metas: [] };
  }

  const skip = extra.skip || 0;
  const search = extra.search as string | undefined;

  try {
    if (id.startsWith("cinemeta_")) {
      const cinemetaId = id.replace("cinemeta_", "");
      const url = `${CINEMETA_BASE}/catalog/${type}/${cinemetaId}.json?skip=${skip}`;
      const data = await fetchJson<CinemetaCatalog>(url);
      if (!data) return { metas: [] };

      let metas: CinemetaMeta[] = data.metas || [];

      if (search) {
        const q = search.toLowerCase();
        metas = metas.filter((m) => m.name.toLowerCase().includes(q));
      }

      metas = filterAnime(metas);

      return { metas };
    }

    return { metas: [] };
  } catch (err) {
    console.error("Catalog error:", err);
    return { metas: [] };
  }
}

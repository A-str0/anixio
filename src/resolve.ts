import { Anixart } from "anixapi";
import type { ContentType } from "stremio-addon-sdk";

const client = new Anixart({});

const CINEMETA_BASE = "https://v3-cinemeta.strem.io";

interface CinemetaMeta {
  meta: {
    name: string;
    year?: string;
    type?: string;
  };
}

function parseImdbId(id: string): { baseId: string; episode?: number; season?: number } | null {
  const match = id.match(/^(tt\d+)(?::(\d+):(\d+))?$/);
  if (!match) return null;
  return {
    baseId: match[1],
    season: match[2] ? parseInt(match[2], 10) : undefined,
    episode: match[3] ? parseInt(match[3], 10) : undefined,
  };
}

async function fetchCinemetaTitle(type: ContentType, imdbId: string): Promise<string | null> {
  try {
    const url = `${CINEMETA_BASE}/meta/${type}/${imdbId}.json`;
    console.log("Anixio: fetching cinemeta", url);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.log("Anixio: cinemeta not ok", resp.status);
      return null;
    }
    const data = (await resp.json()) as CinemetaMeta;
    const name = data.meta?.name || null;
    console.log("Anixio: cinemeta title", name);
    return name;
  } catch (err) {
    console.log("Anixio: cinemeta error", String(err));
    return null;
  }
}

async function searchAnixartByName(query: string): Promise<number | null> {
  try {
    const result = await client.endpoints.search.releaseSearch(0, {
      query,
      searchBy: 0,
      page: 1,
    });
    if (!result.content || result.content.length === 0) {
      console.log("Anixio: search no results for", query);
      return null;
    }
    const id = result.content[0].id;
    console.log("Anixio: search found", id, "for", query);
    return id;
  } catch (err) {
    console.log("Anixio: search error", String(err));
    return null;
  }
}

export async function resolveToAnixart(type: ContentType, id: string): Promise<number | null> {
  const parsed = parseImdbId(id);
  if (!parsed) return null;

  const title = await fetchCinemetaTitle(type, parsed.baseId);
  if (!title) return null;

  const anixartId = await searchAnixartByName(title);
  return anixartId;
}

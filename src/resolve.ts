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
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as CinemetaMeta;
    return data.meta?.name || null;
  } catch {
    return null;
  }
}

async function searchAnixart(query: string): Promise<number | null> {
  try {
    const result = await client.call<any, any>({
      path: "/search/releases/0",
      method: "POST",
      json: { query, searchBy: 0, page: 1 },
    });
    if (!result.content || result.content.length === 0) return null;
    return result.content[0].id as number;
  } catch {
    return null;
  }
}

function titleVariations(title: string): string[] {
  const parts = title.split(":");
  const main = parts[0].trim();
  return [...new Set([title, main])];
}

export async function resolveToAnixart(type: ContentType, id: string): Promise<number | null> {
  const parsed = parseImdbId(id);
  if (!parsed) return null;

  const title = await fetchCinemetaTitle(type, parsed.baseId);
  if (!title) return null;

  for (const q of titleVariations(title)) {
    const anixartId = await searchAnixart(q);
    if (anixartId) return anixartId;
  }

  return null;
}

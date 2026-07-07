import { Anixart } from "anixapi";
import type { ContentType } from "stremio-addon-sdk";

const client = new Anixart({});

const CINEMETA_BASE = "https://v3-cinemeta.strem.io";
const ANIXART_API = "https://api.anixart.tv";

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

async function directSearch(query: string): Promise<number | null> {
  try {
    const url = `${ANIXART_API}/search/releases/0`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, searchBy: 0, page: 1 }),
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    if (!data.content || data.content.length === 0) return null;
    return data.content[0].id;
  } catch {
    return null;
  }
}

function titleVariations(title: string): string[] {
  const parts = title.split(":");
  const main = parts[0].trim();
  const variations = [
    title,
    main,
    ...parts.slice(0, 2).map((p) => p.trim()),
  ];
  return [...new Set(variations.filter((v) => v.length > 0))];
}

export async function resolveToAnixart(type: ContentType, id: string): Promise<number | null> {
  const parsed = parseImdbId(id);
  if (!parsed) return null;

  const title = await fetchCinemetaTitle(type, parsed.baseId);
  if (!title) return null;

  for (const q of titleVariations(title)) {
    const anixartId = await directSearch(q);
    if (anixartId) return anixartId;
  }

  return null;
}

import { Anixart } from "anixapi";
import type { ContentType } from "stremio-addon-sdk";

const client = new Anixart({});

const CINEMETA_BASE = "https://v3-cinemeta.strem.io";

interface CinemetaMeta {
  meta: {
    name: string;
    year?: string;
    type?: string;
    releaseInfo?: string;
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

async function fetchCinemetaMeta(type: ContentType, imdbId: string): Promise<{ name: string; year: number | null } | null> {
  try {
    const url = `${CINEMETA_BASE}/meta/${type}/${imdbId}.json`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as CinemetaMeta;
    const name = data.meta?.name;
    if (!name) return null;
    const year = data.meta?.year || data.meta?.releaseInfo || null;
    return { name, year: year ? parseInt(year, 10) || null : null };
  } catch {
    return null;
  }
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-zа-яё0-9]/g, "");
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  if (na.length > 3 && nb.includes(na)) return true;
  if (nb.length > 3 && na.includes(nb)) return true;
  return false;
}

async function findAnixartRelease(title: string, year: number | null): Promise<number | null> {
  try {
    for (let page = 0; page < 5; page++) {
      const body: any = { sort: 3 };
      if (year) {
        body.start_year = year;
        body.end_year = year;
      }
      const result = await client.call<any, any>({
        path: `/filter/${page}`,
        method: "POST",
        json: body,
      });
      if (!result.content || result.content.length === 0) break;
      for (const r of result.content) {
        const names = [r.title_ru, r.title_original, r.title_alt].filter(Boolean);
        for (const n of names) {
          if (titlesMatch(title, n)) return r.id;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function titleVariations(title: string): string[] {
  const parts = title.split(":");
  return [...new Set([title, parts[0].trim()])];
}

export async function resolveToAnixart(type: ContentType, id: string): Promise<number | null> {
  const parsed = parseImdbId(id);
  if (!parsed) return null;

  const meta = await fetchCinemetaMeta(type, parsed.baseId);
  if (!meta) return null;

  for (const q of titleVariations(meta.name)) {
    const anixartId = await findAnixartRelease(q, meta.year);
    if (anixartId) return anixartId;
  }

  return null;
}

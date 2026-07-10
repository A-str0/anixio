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

function normalize(t: string): string {
  return t.toLowerCase().replace(/[^a-zа-яё0-9]/g, "");
}

function seasonPattern(season: number | undefined): RegExp | null {
  if (!season || season <= 1) return null;
  return new RegExp(
    `(?:^|[^a-zа-яё0-9])${season}(?:$|[^a-zа-яё0-9])|` +
    `season\\s*${season}|` +
    `[RSrs]${season}(?:$|[^a-zа-яё0-9])|` +
    `${season}(?:nd|rd|th|й|я|е)`,
    "i"
  );
}

function scoreRelease(
  searchTitle: string,
  release: any,
  season: number | undefined,
  year: number | null
): number {
  let score = 0;
  const sp = seasonPattern(season);
  const names: string[] = [release.title_ru, release.title_original, release.title_alt].filter(Boolean);

  for (const name of names) {
    const nt = normalize(searchTitle);
    const nr = normalize(name);

    if (nt === nr) {
      score = Math.max(score, 100);
    } else if (nr.length >= nt.length && nr.includes(nt)) {
      score = Math.max(score, 85);
    } else if (nt.length >= nr.length && nt.includes(nr)) {
      score = Math.max(score, 70);
    } else {
      const searchWords = searchTitle.toLowerCase().split(/[^a-zа-яё0-9]+/).filter((w: string) => w.length > 3);
      const matched = searchWords.filter((w: string) => nr.includes(w));
      if (matched.length >= searchWords.length * 0.7) {
        score = Math.max(score, 50 + matched.length * 10);
      }
    }
  }

  if (season && release.season === season) {
    score += 50;
  } else if (sp) {
    for (const name of names) {
      if (sp.test(name)) {
        score += 40;
        break;
      }
    }
  }

  if (year && release.year) {
    const releaseYear = parseInt(release.year, 10);
    if (!isNaN(releaseYear)) {
      if (releaseYear === year) score += 10;
      else if (season && season > 1 && releaseYear > year) score += 15;
    }
  }

  return score;
}

async function searchCandidates(query: string, year: number | null): Promise<any[]> {
  const seen = new Set<number>();
  const results: any[] = [];

  const addResults = (content: any[]) => {
    for (const r of content) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        results.push(r);
      }
    }
  };

  const trySearch = async (q: string): Promise<boolean> => {
    const [v2, v1] = await Promise.allSettled([
      (async () => {
        const items: any[] = [];
        for (let page = 0; page < 2; page++) {
          const r = await client.endpoints.search.releaseSearch(page, {
            page,
            query: q,
            searchBy: 0,
          });
          if (!r.content || r.content.length === 0) break;
          items.push(...r.content);
        }
        return items;
      })(),
      (async () => {
        const items: any[] = [];
        for (let page = 0; page < 2; page++) {
          const r = await client.call<any, any>({
            path: `/search/releases/${page}`,
            method: "POST",
            json: { page, query: q, searchBy: 0 },
          });
          if (!r.content || r.content.length === 0) break;
          items.push(...r.content);
        }
        return items;
      })(),
    ]);

    if (v2.status === "fulfilled") addResults(v2.value);
    if (v1.status === "fulfilled") addResults(v1.value);
    return results.length > 0;
  };

  if (await trySearch(query)) return results;

  const colonIdx = query.indexOf(":");
  if (colonIdx > 0) {
    const shortQuery = query.substring(0, colonIdx).trim();
    if (await trySearch(shortQuery)) return results;
  }

  const dashIdx = query.indexOf(" - ");
  if (dashIdx > 0) {
    const shortQuery = query.substring(0, dashIdx).trim();
    if (await trySearch(shortQuery)) return results;
  }

  try {
    for (let page = 0; page < 3; page++) {
      const body: any = { sort: 3 };
      if (year) {
        body.start_year = year;
        body.end_year = year + 5;
      }
      const result = await client.call<any, any>({
        path: `/filter/${page}`,
        method: "POST",
        json: body,
      });
      if (!result.content || result.content.length === 0) break;
      for (const r of result.content) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          results.push(r);
        }
      }
    }
  } catch {}

  return results;
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

  const candidates = await searchCandidates(meta.name, meta.year);

  let bestId: number | null = null;
  let bestScore = 0;

  for (const q of titleVariations(meta.name)) {
    for (const r of candidates) {
      const score = scoreRelease(q, r, parsed.season, meta.year);
      if (score > bestScore) {
        bestScore = score;
        bestId = r.id;
      }
    }
  }

  return bestScore >= 50 ? bestId : null;
}

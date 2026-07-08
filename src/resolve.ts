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
      // Partial match: search title words in release name
      const searchWords = nt.split(/\s+/).filter((w: string) => w.length > 3);
      const matched = searchWords.filter((w: string) => nr.includes(w));
      if (matched.length >= searchWords.length * 0.7) {
        score = Math.max(score, 50 + matched.length * 10);
      }
    }
  }

  // Season bonus
  if (sp) {
    for (const name of names) {
      if (sp.test(name)) {
        score += 40;
        break;
      }
    }
  }

  // Year bonus: prefer matching year or close years for sequels
  if (year && release.year) {
    const releaseYear = parseInt(release.year, 10);
    if (!isNaN(releaseYear)) {
      if (releaseYear === year) score += 10;
      else if (season && season > 1 && releaseYear > year) score += 15;
    }
  }

  return score;
}

async function findAllCandidates(query: string, year: number | null): Promise<any[]> {
  const candidates: any[] = [];
  try {
    for (let page = 0; page < 3; page++) {
      const body: any = { sort: 3 };
      if (year) {
        // Widen year range for sequels
        body.start_year = year;
        body.end_year = (year + 5);
      }
      const result = await client.call<any, any>({
        path: `/filter/${page}`,
        method: "POST",
        json: body,
      });
      if (!result.content || result.content.length === 0) break;
      candidates.push(...result.content);
    }
  } catch {}
  return candidates;
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

  const candidates = await findAllCandidates(meta.name, meta.year);

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

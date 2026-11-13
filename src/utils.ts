import type { MetaPreview, MetaDetail, MetaVideo, ContentType } from "stremio-addon-sdk";
import type { IRelease } from "anixapi";

export const ANIXART_POSTER_BASE = "https://s.anixmirai.com/posters";

// Every upstream call (Anixart API, Kodik, Sibnet, AniLibria, Cinemeta, AniList) can stall for
// minutes, and the anixapi client never forwards an AbortSignal, so steps that cannot be
// cancelled are raced against a timer and abandoned instead.
export const STEP_TIMEOUT_MS = 8_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`${label}: timed out after ${ms} ms`);
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => {
        clearTimeout(timer);
        console.error(`${label}: failed:`, err instanceof Error ? err.message : err);
        resolve(fallback);
      },
    );
  });
}

// Runs fn over items with at most `limit` in flight; workers stop dequeuing once shouldStop()
// is true, so a deadline or a filled result set bounds the work that is still started.
export async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !shouldStop()) {
      const index = next++;
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
}

export function posterUrl(hash: string | undefined | null): string {
  if (!hash) return "";
  return `${ANIXART_POSTER_BASE}/${hash}.jpg`;
}

export function posterThumbUrl(hash: string | undefined | null): string {
  if (!hash) return "";
  return `${ANIXART_POSTER_BASE}/thumbnails/${hash}.jpg`;
}

export function anixartId(releaseId: number): string {
  return `anixart:${releaseId}`;
}

export function parseAnixartId(id: string): number | null {
  const match = id.match(/^anixart:(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function episodeVideoId(releaseId: number, season: number, episode: number): string {
  return `anixart:${releaseId}:${season}:${episode}`;
}

export function parseAnixartEpisodeId(id: string): { releaseId: number; season: number; episode: number } | null {
  const match = id.match(/^anixart:(\d+):(\d+):(\d+)$/);
  if (!match) return null;
  return {
    releaseId: parseInt(match[1], 10),
    season: parseInt(match[2], 10),
    episode: parseInt(match[3], 10),
  };
}

function releaseTypeToStremio(release: IRelease): ContentType {
  if (release.category?.id === 2) return "movie";
  return "series";
}

function parseGenres(genresStr: string): string[] {
  if (!genresStr) return [];
  return genresStr.split(",").map((g) => g.trim()).filter(Boolean);
}

export function toMetaPreview(release: IRelease): MetaPreview {
  return {
    id: anixartId(release.id),
    type: releaseTypeToStremio(release),
    name: release.title_ru || release.title_original || "",
    poster: posterThumbUrl(release.poster),
    posterShape: "regular",
  };
}

export function toMetaDetail(release: IRelease): MetaDetail {
  const totalEps = release.episodes_total || 0;
  const season = 1;

  const videos: MetaVideo[] = [];
  for (let ep = 1; ep <= totalEps; ep++) {
    videos.push({
      id: episodeVideoId(release.id, season, ep),
      title: `Эпизод ${ep}`,
      released: release.release_date || String(release.aired_on_date || ""),
      season,
      episode: ep,
    });
  }

  return {
    id: anixartId(release.id),
    type: releaseTypeToStremio(release),
    name: release.title_ru || release.title_original || "",
    poster: posterUrl(release.poster),
    background: posterUrl(release.poster),
    description: release.description || "",
    releaseInfo: String(release.year || ""),
    genres: parseGenres(release.genres),
    imdbRating: release.grade ? String(Math.round(release.grade * 20) / 10) : undefined,
    runtime: release.episodes_total
      ? `${release.episodes_released || 0}/${release.episodes_total} эп.`
      : undefined,
    videos: videos.length > 0 ? videos : undefined,
  };
}

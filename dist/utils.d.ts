import type { MetaPreview, MetaDetail } from "stremio-addon-sdk";
import type { IRelease } from "anixapi";
export declare const ANIXART_POSTER_BASE = "https://s.anixmirai.com/posters";
export declare const STEP_TIMEOUT_MS = 8000;
export declare function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T>;
export declare function mapLimit<T>(items: T[], limit: number, fn: (item: T, index: number) => Promise<void>, shouldStop?: () => boolean): Promise<void>;
export declare function posterUrl(hash: string | undefined | null): string;
export declare function posterThumbUrl(hash: string | undefined | null): string;
export declare function anixartId(releaseId: number): string;
export declare function parseAnixartId(id: string): number | null;
export declare function episodeVideoId(releaseId: number, season: number, episode: number): string;
export declare function parseAnixartEpisodeId(id: string): {
    releaseId: number;
    season: number;
    episode: number;
} | null;
export declare function toMetaPreview(release: IRelease): MetaPreview;
export declare function toMetaDetail(release: IRelease): MetaDetail;

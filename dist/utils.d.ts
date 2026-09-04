import type { MetaPreview, MetaDetail } from "stremio-addon-sdk";
import type { IRelease } from "anixapi";
export declare const ANIXART_POSTER_BASE = "https://s.anixmirai.com/posters";
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

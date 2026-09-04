import type { ContentType } from "stremio-addon-sdk";
export declare function scoreRelease(searchTitle: string, release: any, season: number | undefined, year: number | null): number;
export declare function resolveToAnixart(type: ContentType, id: string): Promise<number | null>;

import type { ContentType, MetaDetail } from "stremio-addon-sdk";
export declare function metaHandler(args: {
    type: ContentType;
    id: string;
}): Promise<{
    meta: MetaDetail;
}>;

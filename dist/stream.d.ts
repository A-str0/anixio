import type { ContentType, Stream } from "stremio-addon-sdk";
export declare function streamHandler(args: {
    type: ContentType;
    id: string;
}): Promise<{
    streams: Stream[];
}>;

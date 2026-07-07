import { Anixart } from "anixapi";
import type { ContentType, Stream } from "stremio-addon-sdk";
import { parseAnixartId } from "./utils";

const client = new Anixart({});

export async function streamHandler(args: { type: ContentType; id: string }): Promise<{ streams: Stream[] }> {
  const releaseId = parseAnixartId(args.id);

  if (!releaseId) {
    return { streams: [] };
  }

  try {
    const seen = new Set<string>();
    const streams: Stream[] = [];

    const addVideo = (video: any) => {
      const key = video.url || video.player_url;
      if (!key || seen.has(key)) return;

      const hosting = video.hosting?.name || "Anixart";
      const title = video.title || "";
      const label = title ? `${hosting} — ${title}` : hosting;

      seen.add(key);

      if (video.url) {
        streams.push({ name: "Anixart", title: label, url: video.url });
      }

      if (video.player_url && video.player_url !== video.url) {
        streams.push({
          name: "Anixart",
          title: label + " (плеер)",
          externalUrl: video.player_url,
        });
      }
    };

    try {
      const main = await client.endpoints.releaseVideo.main(releaseId);
      for (const v of main.blocks || []) addVideo(v);
      for (const v of main.last_videos || []) addVideo(v);
    } catch {
      // main endpoint might fail for some releases
    }

    try {
      const page0 = await client.endpoints.releaseVideo.video(releaseId, 0);
      for (const v of page0.content || []) addVideo(v);
    } catch {
      // paginated endpoint might fail
    }

    return { streams };
  } catch (err) {
    console.error("Stream error:", err);
    return { streams: [] };
  }
}

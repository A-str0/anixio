import { Anixart } from "anixapi";
import type { ContentType, MetaDetail } from "stremio-addon-sdk";
import { toMetaDetail, parseAnixartId } from "./utils";
import { resolveToAnixart } from "./resolve";

const client = new Anixart({});

export async function metaHandler(args: { type: ContentType; id: string }) {
  let releaseId = parseAnixartId(args.id);

  if (!releaseId) {
    releaseId = await resolveToAnixart(args.type, args.id);
  }

  if (!releaseId) {
    return { meta: {} as MetaDetail };
  }

  try {
    const result = await client.endpoints.release.release(releaseId);

    if (!result || !result.release) {
      return { meta: {} as MetaDetail };
    }

    const meta = toMetaDetail(result.release);
    return { meta };
  } catch (err) {
    console.error("Meta error:", err);
    return { meta: {} as MetaDetail };
  }
}

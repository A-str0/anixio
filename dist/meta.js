"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaHandler = metaHandler;
const anixapi_1 = require("anixapi");
const utils_1 = require("./utils");
const resolve_1 = require("./resolve");
const client = new anixapi_1.Anixart({});
async function metaHandler(args) {
    let releaseId = (0, utils_1.parseAnixartId)(args.id);
    if (!releaseId) {
        releaseId = await (0, resolve_1.resolveToAnixart)(args.type, args.id);
    }
    if (!releaseId) {
        return { meta: {} };
    }
    try {
        const result = await client.endpoints.release.release(releaseId);
        if (!result || !result.release) {
            return { meta: {} };
        }
        const meta = (0, utils_1.toMetaDetail)(result.release);
        const currentSeason = 1;
        let nextRelease = null;
        const relatedFromRelease = result.release.related_releases;
        if (relatedFromRelease && relatedFromRelease.length > 1) {
            const others = relatedFromRelease
                .filter((r) => r.id !== releaseId)
                .sort((a, b) => a.id - b.id);
            nextRelease = others.find((r) => r.id > releaseId) || others[0];
        }
        if (!nextRelease) {
            try {
                const relatedResp = await client.endpoints.related.related(releaseId, 0);
                const items = relatedResp?.content || [];
                if (items.length > 0) {
                    const others = items
                        .filter((r) => r.id !== releaseId)
                        .sort((a, b) => a.id - b.id);
                    nextRelease = others.find((r) => r.id > releaseId) || others[0];
                }
            }
            catch { }
        }
        if (nextRelease && nextRelease.id && meta.videos) {
            const nextSeasonNum = currentSeason + 1;
            const nextEps = nextRelease.episodes_total || 0;
            for (let ep = 1; ep <= nextEps; ep++) {
                meta.videos.push({
                    id: (0, utils_1.episodeVideoId)(nextRelease.id, nextSeasonNum, ep),
                    title: `Эпизод ${ep}`,
                    released: nextRelease.release_date || String(nextRelease.aired_on_date || ""),
                    season: nextSeasonNum,
                    episode: ep,
                });
            }
        }
        return { meta };
    }
    catch (err) {
        console.error("Meta error:", err);
        return { meta: {} };
    }
}

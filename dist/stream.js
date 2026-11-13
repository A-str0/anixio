"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamHandler = streamHandler;
const anixapi_1 = require("anixapi");
const utils_1 = require("./utils");
const resolve_1 = require("./resolve");
const client = new anixapi_1.Anixart({});
// The dubber walk used to be sequential with no timeouts, so one stalled source held the whole
// response well past Stremio's patience. Dubbers are fanned out, every step is bounded by
// STEP_TIMEOUT_MS, and whatever has resolved by the deadline is returned.
const RESPONSE_DEADLINE_MS = 20_000;
const CONCURRENCY = 8;
const MAX_STREAMS = 50;
// ANIXIO_DEBUG=1 logs where the time goes for each stream request (phase timings, misses).
const DEBUG = process.env.ANIXIO_DEBUG === "1";
const debug = (...parts) => { if (DEBUG)
    console.log("[stream]", ...parts); };
// Anixart's own order: dubbers by popularity, then sources, then episodes.
function byOrder(a, b) {
    return a.dubberIndex - b.dubberIndex || a.sourceIndex - b.sourceIndex || a.position - b.position;
}
function toDirectMp4(m3u8Url) {
    if (m3u8Url.includes(":hls:manifest.m3u8")) {
        return m3u8Url.replace(/:hls:manifest\.m3u8$/, "");
    }
    if (m3u8Url.endsWith(".m3u8")) {
        return m3u8Url.replace(/\.m3u8$/, ".mp4");
    }
    return null;
}
function fixUrl(url) {
    if (url.startsWith("//"))
        return `https:${url}`;
    return url;
}
// Anixart occasionally hands back the rest of an iframe tag after the URL, e.g.
// `https://video.sibnet.ru/shell.php?videoid=123" frameborder="0" scrolling="no`.
function cleanUrl(url) {
    return url.trim().split(/["'\s]/)[0];
}
async function resolveStream(label, sourceUrl) {
    try {
        if (sourceUrl.includes("sibnet")) {
            const directUrl = await anixapi_1.SibnetParser.getDirectLink(sourceUrl);
            if (directUrl)
                return { name: "Anixart", title: label, url: fixUrl(directUrl) };
            return null;
        }
        if (sourceUrl.includes("kodik")) {
            const links = await anixapi_1.KodikParser.getDirectLinks(sourceUrl);
            if (!links)
                return null;
            for (const q of ["720", "480", "360", "240"]) {
                const sources = links[q];
                if (sources && sources.length > 0) {
                    const mp4Url = toDirectMp4(sources[0].src);
                    if (mp4Url) {
                        return { name: "Anixart", title: `${label} (${q}p)`, url: fixUrl(mp4Url) };
                    }
                }
            }
            return null;
        }
        if (sourceUrl.includes("libria") || sourceUrl.includes("anilibria")) {
            const links = await anixapi_1.AniLibriaParser.getDirectLinks(sourceUrl);
            if (!links)
                return null;
            for (const q of ["1080", "720", "480"]) {
                const source = links[q];
                if (source && source.src) {
                    const encoded = Buffer.from(JSON.stringify({ url: source.src, type: "libria" })).toString("base64url");
                    return {
                        name: "Anixart",
                        title: `${label} (${q}p) — CONSUMES SIGNIFICANT BANDWIDTH`,
                        url: `/play?m=${encoded}`,
                    };
                }
            }
            return null;
        }
        return null;
    }
    catch {
        return null;
    }
}
// Walks dubbers → sources → episodes and appends every matching episode to `out` as it is
// found, so a deadline hit mid-walk still leaves the caller with whatever was collected.
async function collectCandidates(releaseId, targetEpisode, out, expired) {
    const typesResult = await (0, utils_1.withTimeout)(client.endpoints.episode.types(releaseId), utils_1.STEP_TIMEOUT_MS, null, `anixart types(${releaseId})`);
    const dubbers = typesResult?.types || [];
    await (0, utils_1.mapLimit)(dubbers, CONCURRENCY, async (dubber, dubberIndex) => {
        const sourcesResult = await (0, utils_1.withTimeout)(client.endpoints.episode.sources(releaseId, dubber.id), utils_1.STEP_TIMEOUT_MS, null, `anixart sources(${releaseId}, ${dubber.name})`);
        const sources = sourcesResult?.sources || [];
        for (const [sourceIndex, source] of sources.entries()) {
            if (expired())
                return;
            const episodesResult = await (0, utils_1.withTimeout)(client.endpoints.episode.episodes(releaseId, dubber.id, source.id), utils_1.STEP_TIMEOUT_MS, null, `anixart episodes(${releaseId}, ${dubber.name}, ${source.name})`);
            const episodes = episodesResult?.episodes || [];
            for (const ep of episodes) {
                if (targetEpisode !== null && ep.position !== targetEpisode)
                    continue;
                const url = ep.url ? cleanUrl(ep.url) : "";
                if (!url)
                    continue;
                const baseLabel = `${dubber.name} | ${source.name}`;
                out.push({
                    dubberIndex,
                    sourceIndex,
                    position: Number(ep.position) || 0,
                    dubberId: dubber.id,
                    label: ep.name ? `${baseLabel} — ${ep.name}` : baseLabel,
                    url,
                });
            }
        }
    }, expired);
}
async function streamHandler(args) {
    const started = Date.now();
    const deadline = started + RESPONSE_DEADLINE_MS;
    const timeLeft = () => deadline - Date.now();
    const expired = () => timeLeft() <= 0;
    const elapsed = () => `after ${Date.now() - started} ms`;
    let episodeInfo = (0, utils_1.parseAnixartEpisodeId)(args.id);
    let releaseId = episodeInfo?.releaseId ?? (0, utils_1.parseAnixartId)(args.id);
    if (!releaseId) {
        const resolved = await (0, utils_1.withTimeout)((0, resolve_1.resolveToAnixart)(args.type, args.id), timeLeft(), null, `resolve ${args.id}`);
        if (resolved) {
            releaseId = resolved;
            const parsed = args.id.match(/:(\d+):(\d+)$/);
            if (parsed) {
                episodeInfo = {
                    releaseId: resolved,
                    season: parseInt(parsed[1], 10),
                    episode: parseInt(parsed[2], 10),
                };
            }
        }
    }
    debug(args.id, "release", releaseId, elapsed());
    if (!releaseId || expired())
        return { streams: [] };
    const targetEpisode = episodeInfo?.episode ?? null;
    const candidates = [];
    const collected = await (0, utils_1.withTimeout)(collectCandidates(releaseId, targetEpisode, candidates, expired).then(() => "done"), timeLeft(), "deadline", `collect ${args.id}`);
    debug(args.id, "candidates", candidates.length, collected, elapsed());
    if (expired())
        return { streams: [] };
    // Several dubbers (typically subtitle groups) point at the same player URL; resolve it once.
    const seen = new Set();
    const unique = candidates
        .sort(byOrder)
        .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
    // Candidates are tried in order until MAX_STREAMS have actually resolved (or time runs out).
    const resolved = [];
    const finished = await (0, utils_1.withTimeout)((0, utils_1.mapLimit)(unique, CONCURRENCY, async (c) => {
        const stream = await (0, utils_1.withTimeout)(resolveStream(c.label, c.url), utils_1.STEP_TIMEOUT_MS, null, `resolve ${c.label}`);
        if (stream) {
            stream.behaviorHints = { group: String(c.dubberId) };
            resolved.push({ candidate: c, stream });
        }
        else {
            debug(args.id, "no stream:", c.label, c.url.slice(0, 70));
        }
    }, () => expired() || resolved.length >= MAX_STREAMS).then(() => "done"), timeLeft(), "deadline", `streams ${args.id}`);
    debug(args.id, "streams", resolved.length, "of", unique.length, finished, elapsed());
    return {
        streams: resolved
            .sort((a, b) => byOrder(a.candidate, b.candidate))
            .slice(0, MAX_STREAMS)
            .map((r) => r.stream),
    };
}

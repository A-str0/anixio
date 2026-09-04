"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogHandler = catalogHandler;
const anixapi_1 = require("anixapi");
const utils_1 = require("./utils");
const resolve_1 = require("./resolve");
const client = new anixapi_1.Anixart({});
const CINEMETA_BASE = "https://v3-cinemeta.strem.io";
function releaseTypeToStremio(release) {
    if (release.category?.id === 2)
        return "movie";
    return "series";
}
function toMetaPreview(release, enrich) {
    return {
        id: (0, utils_1.anixartId)(release.id),
        type: releaseTypeToStremio(release),
        name: enrich?.name || release.title_ru || release.title_original || "",
        poster: enrich?.poster || (0, utils_1.posterThumbUrl)(release.poster),
        posterShape: "regular",
    };
}
async function catalogHandler(args) {
    const { type, id, extra } = args;
    if (type !== "series" && type !== "movie") {
        return { metas: [] };
    }
    const skip = extra.skip || 0;
    const page = Math.floor(skip / 30);
    const search = extra.search;
    try {
        if (search) {
            return await searchCatalog(type, search);
        }
        const releases = await fetchAnixartCatalog(id, page);
        return { metas: releases.map((r) => toMetaPreview(r)) };
    }
    catch (err) {
        console.error("Catalog error:", err);
        return { metas: [] };
    }
}
async function fetchAnixartCatalog(id, page) {
    switch (id) {
        case "anixart_popular":
            return (await client.endpoints.filter.filter(page, { sort: anixapi_1.FilterSortType.SortPopular })).content || [];
        case "anixart_ongoing":
            return (await client.endpoints.filter.filter(page, { status_id: 2, sort: anixapi_1.FilterSortType.SortPopular })).content || [];
        case "anixart_latest":
            return (await client.endpoints.filter.filter(page, { sort: anixapi_1.FilterSortType.SortDateUpdate })).content || [];
        case "anixart_announce":
            return (await client.endpoints.filter.filter(page, { status_id: 3, sort: anixapi_1.FilterSortType.SortPopular })).content || [];
        default:
            if (id.startsWith("anixart_genre_")) {
                const genreId = id.replace("anixart_genre_", "");
                return (await client.endpoints.filter.filter(page, { genres: [genreId], sort: anixapi_1.FilterSortType.SortPopular })).content || [];
            }
            return [];
    }
}
async function searchAnixartReleases(query) {
    const seen = new Set();
    const releases = [];
    const addResults = (content) => {
        for (const r of content) {
            if (!seen.has(r.id)) {
                seen.add(r.id);
                releases.push(r);
            }
        }
    };
    const [v2, v1] = await Promise.allSettled([
        (async () => {
            for (let p = 0; p < 2; p++) {
                const r = await client.endpoints.search.releaseSearch(p, { page: p, query, searchBy: 0 });
                if (!r.content || r.content.length === 0)
                    break;
                addResults(r.content);
            }
        })(),
        (async () => {
            for (let p = 0; p < 2; p++) {
                const r = await client.call({
                    path: `/search/releases/${p}`,
                    method: "POST",
                    json: { page: p, query, searchBy: 0 },
                });
                if (!r.content || r.content.length === 0)
                    break;
                addResults(r.content);
            }
        })(),
    ]);
    return releases;
}
async function searchCinemeta(type, query) {
    try {
        const url = `${CINEMETA_BASE}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
        const resp = await fetch(url);
        if (!resp.ok)
            return [];
        const data = (await resp.json());
        return data.metas || [];
    }
    catch {
        return [];
    }
}
function matchWithCinemeta(anixartReleases, cinemetaResults) {
    const used = new Set();
    const enriched = [];
    for (const release of anixartReleases) {
        let bestMatch = null;
        let bestScore = 0;
        for (const cm of cinemetaResults) {
            if (used.has(cm.id))
                continue;
            const year = cm.releaseInfo ? parseInt(cm.releaseInfo, 10) || null : null;
            const score = (0, resolve_1.scoreRelease)(cm.name, release, undefined, year);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = cm;
            }
        }
        if (bestMatch && bestScore >= 50) {
            used.add(bestMatch.id);
            enriched.push(toMetaPreview(release, {
                name: bestMatch.name,
                poster: bestMatch.poster,
            }));
        }
        else {
            enriched.push(toMetaPreview(release));
        }
    }
    return enriched;
}
async function searchCatalog(type, query) {
    const [anixartResults, cinemetaResults] = await Promise.all([
        searchAnixartReleases(query),
        searchCinemeta(type, query),
    ]);
    if (anixartResults.length === 0 && cinemetaResults.length === 0) {
        return { metas: [] };
    }
    if (anixartResults.length > 0 && cinemetaResults.length > 0) {
        return { metas: matchWithCinemeta(anixartResults, cinemetaResults) };
    }
    if (anixartResults.length > 0) {
        return { metas: anixartResults.map((r) => toMetaPreview(r)) };
    }
    return {
        metas: cinemetaResults.map((cm) => ({
            id: cm.id,
            type: cm.type || type,
            name: cm.name,
            poster: cm.poster,
            posterShape: "regular",
        })),
    };
}

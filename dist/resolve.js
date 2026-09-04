"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreRelease = scoreRelease;
exports.resolveToAnixart = resolveToAnixart;
const anixapi_1 = require("anixapi");
const client = new anixapi_1.Anixart({});
const CINEMETA_BASE = "https://v3-cinemeta.strem.io";
function parseImdbId(id) {
    const match = id.match(/^(tt\d+)(?::(\d+):(\d+))?$/);
    if (!match)
        return null;
    return {
        baseId: match[1],
        season: match[2] ? parseInt(match[2], 10) : undefined,
        episode: match[3] ? parseInt(match[3], 10) : undefined,
    };
}
async function fetchCinemetaMeta(type, imdbId) {
    try {
        const url = `${CINEMETA_BASE}/meta/${type}/${imdbId}.json`;
        const resp = await fetch(url);
        if (!resp.ok)
            return null;
        const data = (await resp.json());
        const name = data.meta?.name;
        if (!name)
            return null;
        const year = data.meta?.year || data.meta?.releaseInfo || null;
        return { name, year: year ? parseInt(year, 10) || null : null };
    }
    catch {
        return null;
    }
}
function normalize(t) {
    return t.toLowerCase().replace(/[^a-zа-яё0-9]/g, "");
}
function seasonPattern(season) {
    if (!season || season <= 1)
        return null;
    return new RegExp(`(?:^|[^a-zа-яё0-9])${season}(?:$|[^a-zа-яё0-9])|` +
        `season\\s*${season}|` +
        `[RSrs]${season}(?:$|[^a-zа-яё0-9])|` +
        `${season}(?:nd|rd|th|й|я|е)`, "i");
}
function scoreRelease(searchTitle, release, season, year) {
    let nameScore = 0;
    const sp = seasonPattern(season);
    const names = [release.title_ru, release.title_original, release.title_alt].filter(Boolean);
    for (const name of names) {
        const nt = normalize(searchTitle);
        const nr = normalize(name);
        if (nt === nr) {
            nameScore = Math.max(nameScore, 100);
        }
        else if (nr.length >= nt.length && nr.includes(nt)) {
            nameScore = Math.max(nameScore, 85);
        }
        else if (nt.length >= nr.length && nt.includes(nr)) {
            nameScore = Math.max(nameScore, 70);
        }
        else {
            const searchWords = searchTitle.toLowerCase().split(/[^a-zа-яё0-9]+/).filter((w) => w.length > 3);
            const matched = searchWords.filter((w) => nr.includes(w));
            if (matched.length >= searchWords.length * 0.7) {
                nameScore = Math.max(nameScore, 50 + matched.length * 10);
            }
        }
    }
    if (nameScore === 0)
        return 0;
    let score = nameScore;
    if (season && release.season === season) {
        score += 50;
    }
    else if (sp) {
        for (const name of names) {
            if (sp.test(name)) {
                score += 40;
                break;
            }
        }
    }
    if (year && release.year) {
        const releaseYear = parseInt(release.year, 10);
        if (!isNaN(releaseYear)) {
            if (releaseYear === year)
                score += 10;
            else if (season && season > 1 && releaseYear > year)
                score += 15;
        }
    }
    return score;
}
async function searchCandidates(query, year) {
    const seen = new Set();
    const results = [];
    const addResults = (content) => {
        for (const r of content) {
            if (!seen.has(r.id)) {
                seen.add(r.id);
                results.push(r);
            }
        }
    };
    const trySearch = async (q) => {
        const [v2, v1] = await Promise.allSettled([
            (async () => {
                const items = [];
                for (let page = 0; page < 2; page++) {
                    const r = await client.endpoints.search.releaseSearch(page, {
                        page,
                        query: q,
                        searchBy: 0,
                    });
                    if (!r.content || r.content.length === 0)
                        break;
                    items.push(...r.content);
                }
                return items;
            })(),
            (async () => {
                const items = [];
                for (let page = 0; page < 2; page++) {
                    const r = await client.call({
                        path: `/search/releases/${page}`,
                        method: "POST",
                        json: { page, query: q, searchBy: 0 },
                    });
                    if (!r.content || r.content.length === 0)
                        break;
                    items.push(...r.content);
                }
                return items;
            })(),
        ]);
        if (v2.status === "fulfilled")
            addResults(v2.value);
        if (v1.status === "fulfilled")
            addResults(v1.value);
        return results.length > 0;
    };
    if (await trySearch(query))
        return results;
    const colonIdx = query.indexOf(":");
    if (colonIdx > 0) {
        const shortQuery = query.substring(0, colonIdx).trim();
        if (await trySearch(shortQuery))
            return results;
    }
    const dashIdx = query.indexOf(" - ");
    if (dashIdx > 0) {
        const shortQuery = query.substring(0, dashIdx).trim();
        if (await trySearch(shortQuery))
            return results;
    }
    return results;
}
function titleVariations(title) {
    const variations = new Set([title]);
    const colonIdx = title.indexOf(":");
    if (colonIdx > 0) {
        variations.add(title.substring(0, colonIdx).trim());
    }
    if (title.toLowerCase().startsWith("the ")) {
        variations.add(title.substring(4));
    }
    return [...variations];
}
async function fetchAnilistRomaji(title) {
    try {
        const resp = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `query($s: String){Media(search:$s,type:ANIME){title{romaji}}}`,
                variables: { s: title },
            }),
        });
        if (!resp.ok)
            return null;
        const data = (await resp.json());
        return data?.data?.Media?.title?.romaji || null;
    }
    catch {
        return null;
    }
}
async function resolveToAnixart(type, id) {
    const parsed = parseImdbId(id);
    if (!parsed)
        return null;
    const meta = await fetchCinemetaMeta(type, parsed.baseId);
    if (!meta)
        return null;
    const romaji = await fetchAnilistRomaji(meta.name);
    const searchQuery = romaji || meta.name;
    const candidates = await searchCandidates(searchQuery, meta.year);
    if (candidates.length === 0)
        return null;
    let bestId = null;
    let bestScore = 0;
    const queries = [romaji, ...titleVariations(meta.name)].filter(Boolean);
    for (const q of queries) {
        for (const r of candidates) {
            const score = scoreRelease(q, r, parsed.season, meta.year);
            if (score > bestScore) {
                bestScore = score;
                bestId = r.id;
            }
        }
    }
    if (bestScore >= 50)
        return bestId;
    return candidates[0].id;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANIXART_POSTER_BASE = void 0;
exports.posterUrl = posterUrl;
exports.posterThumbUrl = posterThumbUrl;
exports.anixartId = anixartId;
exports.parseAnixartId = parseAnixartId;
exports.episodeVideoId = episodeVideoId;
exports.parseAnixartEpisodeId = parseAnixartEpisodeId;
exports.toMetaPreview = toMetaPreview;
exports.toMetaDetail = toMetaDetail;
exports.ANIXART_POSTER_BASE = "https://s.anixmirai.com/posters";
function posterUrl(hash) {
    if (!hash)
        return "";
    return `${exports.ANIXART_POSTER_BASE}/${hash}.jpg`;
}
function posterThumbUrl(hash) {
    if (!hash)
        return "";
    return `${exports.ANIXART_POSTER_BASE}/thumbnails/${hash}.jpg`;
}
function anixartId(releaseId) {
    return `anixart:${releaseId}`;
}
function parseAnixartId(id) {
    const match = id.match(/^anixart:(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
}
function episodeVideoId(releaseId, season, episode) {
    return `anixart:${releaseId}:${season}:${episode}`;
}
function parseAnixartEpisodeId(id) {
    const match = id.match(/^anixart:(\d+):(\d+):(\d+)$/);
    if (!match)
        return null;
    return {
        releaseId: parseInt(match[1], 10),
        season: parseInt(match[2], 10),
        episode: parseInt(match[3], 10),
    };
}
function releaseTypeToStremio(release) {
    if (release.category?.id === 2)
        return "movie";
    return "series";
}
function parseGenres(genresStr) {
    if (!genresStr)
        return [];
    return genresStr.split(",").map((g) => g.trim()).filter(Boolean);
}
function toMetaPreview(release) {
    return {
        id: anixartId(release.id),
        type: releaseTypeToStremio(release),
        name: release.title_ru || release.title_original || "",
        poster: posterThumbUrl(release.poster),
        posterShape: "regular",
    };
}
function toMetaDetail(release) {
    const totalEps = release.episodes_total || 0;
    const season = 1;
    const videos = [];
    for (let ep = 1; ep <= totalEps; ep++) {
        videos.push({
            id: episodeVideoId(release.id, season, ep),
            title: `Эпизод ${ep}`,
            released: release.release_date || String(release.aired_on_date || ""),
            season,
            episode: ep,
        });
    }
    return {
        id: anixartId(release.id),
        type: releaseTypeToStremio(release),
        name: release.title_ru || release.title_original || "",
        poster: posterUrl(release.poster),
        background: posterUrl(release.poster),
        description: release.description || "",
        releaseInfo: String(release.year || ""),
        genres: parseGenres(release.genres),
        imdbRating: release.grade ? String(Math.round(release.grade * 20) / 10) : undefined,
        runtime: release.episodes_total
            ? `${release.episodes_released || 0}/${release.episodes_total} эп.`
            : undefined,
        videos: videos.length > 0 ? videos : undefined,
    };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewriteManifest = rewriteManifest;
exports.proxySegments = proxySegments;
function unwrapCdnUrl(url) {
    const proxyMatch = url.match(/^(https?:\/\/[^/]+)\/s\/m\/(.+)$/);
    if (!proxyMatch)
        return url;
    const host = proxyMatch[1];
    const rest = proxyMatch[2];
    const parts = rest.split("/");
    if (parts.length < 3)
        return url;
    const segment = parts.pop();
    const token = parts.pop();
    const encoded = parts.join("/");
    try {
        const decoded = Buffer.from(encoded, "base64").toString("utf-8");
        if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
            return `${decoded}/${token}/${segment}`;
        }
    }
    catch { }
    return url;
}
function rewriteManifest(m3u8Content, cdnBase) {
    if (!cdnBase)
        return m3u8Content;
    const lines = m3u8Content.split("\n");
    const rewritten = [];
    for (const line of lines) {
        if (line.startsWith("#") || line.trim() === "") {
            rewritten.push(line);
        }
        else if (line.startsWith("http://") || line.startsWith("https://")) {
            rewritten.push(unwrapCdnUrl(line));
        }
        else if (line.startsWith("//")) {
            rewritten.push(unwrapCdnUrl(`https:${line}`));
        }
        else {
            rewritten.push(new URL(line, cdnBase).toString());
        }
    }
    return rewritten.join("\n");
}
function proxySegments(m3u8Content, cdnBase) {
    if (!cdnBase)
        return m3u8Content;
    const lines = m3u8Content.split("\n");
    const rewritten = [];
    for (const line of lines) {
        if (line.startsWith("#") || line.trim() === "") {
            rewritten.push(line);
        }
        else {
            let absoluteUrl;
            if (line.startsWith("http://") || line.startsWith("https://")) {
                absoluteUrl = line;
            }
            else if (line.startsWith("//")) {
                absoluteUrl = `https:${line}`;
            }
            else {
                absoluteUrl = new URL(line, cdnBase).toString();
            }
            const proxyPath = `/seg?url=${encodeURIComponent(absoluteUrl)}`;
            rewritten.push(proxyPath);
        }
    }
    return rewritten.join("\n");
}

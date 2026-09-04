"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const stremio_addon_sdk_1 = require("stremio-addon-sdk");
const addon_1 = require("./addon");
const play_1 = require("./play");
const port = parseInt(process.env.PORT || "7000", 10);
const router = (0, stremio_addon_sdk_1.getRouter)(addon_1.addonInterface);
function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
}
function getQueryParam(req, name) {
    try {
        return new URL(req.url || "/", "http://localhost").searchParams.get(name);
    }
    catch {
        return null;
    }
}
async function handlePlay(req, res) {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }
    try {
        const m = getQueryParam(req, "m");
        if (!m) {
            res.writeHead(400);
            return res.end(JSON.stringify({ err: "missing m" }));
        }
        let data;
        try {
            data = JSON.parse(Buffer.from(m, "base64url").toString("utf-8"));
        }
        catch {
            res.writeHead(400);
            return res.end(JSON.stringify({ err: "invalid m" }));
        }
        if (!data.url) {
            res.writeHead(400);
            return res.end(JSON.stringify({ err: "no url" }));
        }
        const resp = await fetch(data.url);
        if (!resp.ok) {
            res.writeHead(502);
            return res.end(JSON.stringify({ err: "unreachable" }));
        }
        const content = await resp.text();
        const baseUrl = data.url.substring(0, data.url.lastIndexOf("/") + 1);
        const isProxied = data.type === "libria";
        const rewritten = isProxied ? (0, play_1.proxySegments)(content, baseUrl) : (0, play_1.rewriteManifest)(content, baseUrl);
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.end(rewritten);
    }
    catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ err: e.message }));
    }
}
async function handleSeg(req, res) {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }
    try {
        const targetUrl = getQueryParam(req, "url");
        if (!targetUrl) {
            res.writeHead(400);
            return res.end("missing url");
        }
        const resp = await fetch(targetUrl);
        if (!resp.ok) {
            res.writeHead(502);
            return res.end("unreachable");
        }
        const ct = resp.headers.get("content-type") || "video/mp2t";
        res.setHeader("Content-Type", ct);
        res.setHeader("Content-Length", resp.headers.get("content-length") || "");
        res.setHeader("Cache-Control", "public, max-age=3600");
        const body = await resp.arrayBuffer();
        res.end(Buffer.from(body));
    }
    catch (e) {
        res.writeHead(500);
        res.end(e.message);
    }
}
const server = http.createServer((req, res) => {
    if (req.url?.startsWith("/seg"))
        return handleSeg(req, res);
    if (req.url?.startsWith("/play"))
        return handlePlay(req, res);
    router(req, res, () => {
        res.writeHead(404);
        res.end(JSON.stringify({ err: "not found" }));
    });
});
server.listen(port, () => {
    console.log(`Anixio addon running at http://localhost:${port}/manifest.json`);
});

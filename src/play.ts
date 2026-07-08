function unwrapCdnUrl(url: string): string {
  const match = url.match(/^(https?:\/\/[^/]+)\/s\/m\/([A-Za-z0-9+/=]+)\/(.+)$/);
  if (!match) return url;

  try {
    const decoded = Buffer.from(match[2], "base64").toString("utf-8");
    if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
      return `${decoded}/${match[3]}`;
    }
  } catch {}

  return url;
}

export function rewriteManifest(m3u8Content: string, cdnBase: string): string {
  if (!cdnBase) return m3u8Content;

  const lines = m3u8Content.split("\n");
  const rewritten: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") {
      rewritten.push(line);
    } else if (line.startsWith("http://") || line.startsWith("https://")) {
      rewritten.push(unwrapCdnUrl(line));
    } else if (line.startsWith("//")) {
      rewritten.push(unwrapCdnUrl(`https:${line}`));
    } else {
      rewritten.push(new URL(line, cdnBase).toString());
    }
  }

  return rewritten.join("\n");
}

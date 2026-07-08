# Anixio

Unofficial Stremio addon for anime powered by [Anixart.tv](https://anixart.tv). Provides catalogs, metadata, and streaming from multiple sources.

## Features

- **Catalogs** — popular, ongoing, latest, upcoming, and genre-based browsing (action, comedy, drama, fantasy, romance, sci-fi, slice of life, supernatural, shounen, isekai)
- **Metadata** — poster, background, description, year, genres, rating, episode count
- **Streaming** from three sources:
  - **Sibnet** — direct MP4 links
  - **Kodik** — quality selection (720p → 480p → 360p → 240p)
  - **AniLibria** — HLS streams proxied through the addon server
- **IMDB compatibility** — automatic IMDB ID ↔ Anixart ID resolution via Cinemeta
- **HLS proxying** — `.m3u8` manifest rewriting and `.ts` segment proxying to bypass CORS

## Installation

### Local

```bash
npm ci
npm run build
npm start
```

The server starts on port `7000`. Addon URL for Stremio:

```
http://localhost:7000/manifest.json
```

### Docker

```bash
docker build -t anixio .
docker run -p 7000:7000 anixio
```

### Vercel

Not recommended, as some sources like *Kodik* may be unreachable.

```bash
npm install -g vercel
vercel
```

## Source structure

```
src/
├── server.ts     # HTTP server (port 7000)
├── addon.ts      # Stremio manifest and handlers
├── catalog.ts    # Catalogs and search
├── meta.ts       # Release metadata
├── stream.ts     # Video sources
├── resolve.ts    # IMDB ID → Anixart ID
├── play.ts       # HLS rewriting and segment proxying
└── utils.ts      # Utilities and types
```

## License

MIT

## P.S.
it's all vibecoded btw :)

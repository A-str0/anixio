import { addonBuilder } from "stremio-addon-sdk";
import { catalogHandler } from "./catalog";
import { metaHandler } from "./meta";
import { streamHandler } from "./stream";

const builder = new addonBuilder({
  id: "community.anixio",
  version: "1.0.0",
  name: "Anixio",
  description: "Anime catalog and streams from Anixart",
  logo: "https://s.anixmirai.com/posters/thumbnails/default.jpg",
  resources: ["catalog", "meta", "stream"],
  types: ["series", "movie"],
  idPrefixes: ["anixart", "tt", "kitsu"],
  catalogs: [
    { id: "anixart_popular", name: "Anixart — Популярное", type: "series" },
    { id: "anixart_ongoing", name: "Anixart — Онгоинги", type: "series" },
    { id: "anixart_latest", name: "Anixart — Новинки", type: "series" },
    { id: "anixart_announce", name: "Anixart — Анонсы", type: "series" },
    { id: "anixart_genre_1", name: "Anixart — Экшен", type: "series" },
    { id: "anixart_genre_3", name: "Anixart — Комедия", type: "series" },
    { id: "anixart_genre_4", name: "Anixart — Драма", type: "series" },
    { id: "anixart_genre_6", name: "Anixart — Фэнтези", type: "series" },
    { id: "anixart_genre_13", name: "Anixart — Романтика", type: "series" },
    { id: "anixart_genre_14", name: "Anixart — Фантастика", type: "series" },
    { id: "anixart_genre_15", name: "Anixart — Повседневность", type: "series" },
    { id: "anixart_genre_17", name: "Anixart — Сверхъестественное", type: "series" },
    { id: "anixart_genre_19", name: "Anixart — Сёнен", type: "series" },
    { id: "anixart_genre_25", name: "Anixart — Исэкай", type: "series" },
    { id: "cinemeta_top", name: "Cinemeta — Популярное", type: "series" },
    { id: "cinemeta_top", name: "Cinemeta — Популярное", type: "movie" },
    { id: "cinemeta_year", name: "Cinemeta — Новинки", type: "series" },
    { id: "cinemeta_year", name: "Cinemeta — Новинки", type: "movie" },
  ],
});

builder.defineCatalogHandler(catalogHandler);
builder.defineMetaHandler(metaHandler);
builder.defineStreamHandler(streamHandler);

export const addonInterface = builder.getInterface();

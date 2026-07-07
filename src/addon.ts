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
  idPrefixes: ["anixart"],
  catalogs: [
    { id: "anixart_popular", name: "Популярное", type: "series" },
    { id: "anixart_ongoing", name: "Онгоинги", type: "series" },
    { id: "anixart_latest", name: "Новинки", type: "series" },
    { id: "anixart_announce", name: "Анонсы", type: "series" },
    { id: "anixart_popular", name: "Популярное", type: "movie" },
    { id: "anixart_ongoing", name: "Онгоинги", type: "movie" },
    { id: "anixart_latest", name: "Новинки", type: "movie" },
    { id: "anixart_announce", name: "Анонсы", type: "movie" },
    { id: "anixart_genre_5", name: "Этти", type: "series" },
    { id: "anixart_genre_6", name: "Фэнтези", type: "series" },
    { id: "anixart_genre_13", name: "Романтика", type: "series" },
    { id: "anixart_genre_14", name: "Фантастика", type: "series" },
    { id: "anixart_genre_15", name: "Повседневность", type: "series" },
    { id: "anixart_genre_17", name: "Сверхъестественное", type: "series" },
    { id: "anixart_genre_19", name: "Сёнен", type: "series" },
    { id: "anixart_genre_20", name: "Сэйнэн", type: "series" },
    { id: "anixart_genre_25", name: "Исэкай", type: "series" },
    { id: "anixart_genre_3", name: "Комедия", type: "series" },
    { id: "anixart_genre_1", name: "Экшен", type: "series" },
    { id: "anixart_genre_4", name: "Драма", type: "series" },
  ],
});

builder.defineCatalogHandler(catalogHandler);
builder.defineMetaHandler(metaHandler);
builder.defineStreamHandler(streamHandler);

export const addonInterface = builder.getInterface();

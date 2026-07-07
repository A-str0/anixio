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
    { id: "cinemeta_top", name: "Cinemeta — Popular", type: "series" },
    { id: "cinemeta_top", name: "Cinemeta — Popular", type: "movie" },
    { id: "cinemeta_year", name: "Cinemeta — New", type: "series" },
    { id: "cinemeta_year", name: "Cinemeta — New", type: "movie" },
    { id: "cinemeta_imdbRating", name: "Cinemeta — Featured", type: "series" },
    { id: "cinemeta_imdbRating", name: "Cinemeta — Featured", type: "movie" },
  ],
});

builder.defineCatalogHandler(catalogHandler);
builder.defineMetaHandler(metaHandler);
builder.defineStreamHandler(streamHandler);

export const addonInterface = builder.getInterface();

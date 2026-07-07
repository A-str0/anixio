import { serveHTTP } from "stremio-addon-sdk";
import { addonInterface } from "./addon";

const port = parseInt(process.env.PORT || "7000", 10);

serveHTTP(addonInterface, { port, cacheMaxAge: 86400 });

console.log(`Anixio addon running at http://localhost:${port}/manifest.json`);

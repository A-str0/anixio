import { getRouter } from "stremio-addon-sdk";

const { addonInterface } = require("../dist/addon");

export default getRouter(addonInterface);

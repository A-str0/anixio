const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const { addonInterface } = require("./dist/addon");

const app = express();
const router = getRouter(addonInterface);

app.use(router);

app.use((_req, res) => {
  res.status(404).json({ err: "not found" });
});

module.exports = app;

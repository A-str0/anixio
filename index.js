const { getRouter } = require("stremio-addon-sdk");
const { addonInterface } = require("./dist/addon");

const router = getRouter(addonInterface);

module.exports = (req, res) => {
  router(req, res, () => {
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};

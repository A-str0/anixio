const { getRouter } = require("stremio-addon-sdk");
const addonInterface = require("./dist/addon");

const router = getRouter(addonInterface);

module.exports = function (req, res) {
  router(req, res, function () {
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};

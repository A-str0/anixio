const { getRouter } = require("stremio-addon-sdk");

let addonInterface;
try {
  addonInterface = require("./dist/addon").addonInterface;
} catch (e) {
  module.exports = function (_req, res) {
    res.statusCode = 500;
    res.end(JSON.stringify({ err: "addon load error", msg: e.message }));
  };
  return;
}

if (!addonInterface) {
  module.exports = function (_req, res) {
    res.statusCode = 500;
    res.end(JSON.stringify({ err: "addonInterface is undefined" }));
  };
  return;
}

const router = getRouter(addonInterface);

module.exports = function (req, res) {
  router(req, res, function () {
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};

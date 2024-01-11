const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const files = [
  "/browserconfig.xml",
  "/manifest.webmanifest",
  "/yandex-browser-manifest.json",
];

const renderMetadata = async (req, res, next) => {
  try {
    if (
      new RegExp(/get/, "i").test(req.method) &&
      files.indexOf(req.url) > -1
    ) {
      const filePath = path.join(__dirname, "..", "public", req.url);
      const fileData = fs.readFileSync(filePath)?.toString();
      res.set("Content-Type", mime.lookup(filePath));
      if (fileData) {
        return res
          .status(200)
          .send(
            fileData
              .replace("卐卐S3卐卐", req.hostname)
              .replace("卐卐DOMAIN卐卐", req.hostname)
          );
      }
    }
  } catch (err) {
    console.log("Metadata error", err);
  }
  next();
};

module.exports = renderMetadata;

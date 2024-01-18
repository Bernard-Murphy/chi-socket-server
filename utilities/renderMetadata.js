const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const { getInstanceInfo } = require("../db");

const renderMetadata = async (req, res, next) => {
  try {
    if (req.url.includes("/static/") && path.extname(req.url) === ".js") {
      const filePath = path.join(__dirname, "..", "public", req.url);
      let fileData = fs.readFileSync(filePath)?.toString();
      if (fileData) {
        const instanceID = process.env.DATABASE;
        const hostname = req.hostname;
        const instanceInfo = await getInstanceInfo({ hostname, instanceID });

        Object.keys(instanceInfo.preferences)
          .filter((key) => key !== "gigachad")
          .forEach((key) => {
            fileData = fileData
              .split("\\u5350\\u5350" + key + "\\u5350\\u5350")
              .join(instanceInfo.preferences[key]);
            fileData = fileData
              .split("卐卐" + key + "卐卐")
              .join(instanceInfo.preferences[key]);
          });

        fileData = fileData
          .split("\\u5350\\u5350bucket_host\\u5350\\u5350")
          .join(process.env.BUCKET_HOST);
        fileData = fileData
          .split("\\u5350\\u5350instanceID\\u5350\\u5350")
          .join(instanceInfo.instanceID);
        fileData = fileData
          .split("卐卐bucket_host卐卐")
          .join(process.env.BUCKET_HOST);
        fileData = fileData
          .split("卐卐instanceID卐卐")
          .join(instanceInfo.instanceID);
        res.set("Content-Type", mime.lookup(filePath));
        return res.status(200).send(fileData);
      }
    }
  } catch (err) {
    console.log("Metadata error", err);
  }
  next();
};

module.exports = renderMetadata;

const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const { getInstanceInfo } = require("../db");

const renderMetadata = async (req, res, next) => {
  try {
    // console.log(req.url);
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
            console.log(
              key,
              instanceInfo.preferences[key],
              fileData.split("\\u5350\\u5350" + key + "\\u5350\\u5350").length
            );
            fileData.replaceAll(
              "\\u5350\\u5350" + key + "\\u5350\\u5350",
              instanceInfo.preferences[key]
            );
          });
        Object.keys(instanceInfo.preferences)
          .filter((key) => key !== "gigachad")
          .forEach((key) => {
            console.log(
              key,
              instanceInfo.preferences[key],
              fileData.split("卐卐" + key + "卐卐").length
            );
            fileData.replaceAll(
              "卐卐" + key + "卐卐",
              instanceInfo.preferences[key]
            );
          });
        fileData.replaceAll(
          "\\u5350\\u5350bucket_host\\u5350\\u5350",
          process.env.BUCKET_HOST
        );
        fileData.replaceAll(
          "\\u5350\\u5350instanceID\\u5350\\u5350",
          instanceInfo.instanceID
        );
        fileData.replaceAll("卐卐bucket_host卐卐", process.env.BUCKET_HOST);
        fileData.replaceAll("卐卐instanceID卐卐", instanceInfo.instanceID);
        res.set("Content-Type", mime.lookup(filePath));
        return res.status(200).send(fileData);
      }
    }

    // if (
    //   new RegExp(/get/, "i").test(req.method) &&
    //   files.indexOf(req.url) > -1
    // ) {
    // const filePath = path.join(__dirname, "..", "public", req.url);
    // const fileData = fs.readFileSync(filePath)?.toString();
    // const instanceID = process.env.DATABASE;
    // const hostname = req.hostname;
    // const instanceInfo = await getInstanceInfo({ hostname, instanceID });
    // res.set("Content-Type", mime.lookup(filePath));
    // if (fileData) {
    //   switch (req.url) {
    //     default:
    //       return res
    //         .status(200)
    //         .send(
    //           fileData
    //             .replace(
    //               "卐
    // console.log(req.url);卐S3卐卐",
    //               process.env.BUCKET_HOST + "/" + instanceInfo.instanceID
    //             )
    //             .replace("卐卐DOMAIN卐卐", req.hostname)
    //         );
    //   }
    // }
    // }
  } catch (err) {
    console.log("Metadata error", err);
  }
  next();
};

module.exports = renderMetadata;

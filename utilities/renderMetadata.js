const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const { getInstanceInfo } = require("../db");
const h = require("../utilities/helpers");

const imageExtensions =
  "image/png image/jpeg image/jpg image/gif image/bmp image/webp image/svg+xml ";
const audioExtensions =
  "audio/aac audio/mpeg audio/ogg audio/wav audio/wave audio/x-wav ";
const videoExtensions = "video/mp4 video/webm ";

/**
 *
 * @param {Object} preferences - User preferences
 * @returns String with a list of mimetypes that will be allowed to be uploaded to the instance
 */
const getExtensionString = (preferences) => {
  let string = "";
  if (preferences.imagesAllowed) string += imageExtensions;
  if (preferences.audioAllowed) string += audioExtensions;
  if (preferences.videoAllowed) string += videoExtensions;

  return string.trim();
};

const renderMetadata = async (req, res, next) => {
  try {
    if (req.url.includes("/static/") && path.extname(req.url) === ".js") {
      const filePath = path.join(__dirname, "..", "public", req.url);
      let fileData = fs.readFileSync(filePath)?.toString();
      if (fileData) {
        const hostname = h.parseHost(req.hostname);
        const instanceInfo = await getInstanceInfo({ hostname });

        fileData = fileData
          .split("卐卐max_individual_file_size卐卐")
          .join(
            Math.round(
              Number(instanceInfo.preferences.max_individual_file_size) *
                1024 *
                1024
            )
          );

        fileData = fileData
          .split("卐卐max_total_file_size卐卐")
          .join(
            Math.round(
              Number(instanceInfo.preferences.max_total_file_size) * 1024 * 1024
            )
          );
        fileData = fileData
          .split(
            "\\u5350\\u5350" + "max_individual_file_size" + "\\u5350\\u5350"
          )
          .join(
            Math.round(
              Number(instanceInfo.preferences.max_individual_file_size) *
                1024 *
                1024
            )
          );

        fileData = fileData
          .split("\\u5350\\u5350" + "max_total_file_size" + "\\u5350\\u5350")
          .join(
            Math.round(
              Number(instanceInfo.preferences.max_total_file_size) * 1024 * 1024
            )
          );

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
          .split("卐卐bucket_host卐卐")
          .join(process.env.BUCKET_HOST);
        fileData = fileData
          .split("\\u5350\\u5350captcha_key\\u5350\\u5350")
          .join(process.env.CAPTCHA_KEY);
        fileData = fileData
          .split("卐卐captcha_key卐卐")
          .join(process.env.CAPTCHA_KEY);
        fileData = fileData
          .split("\\u5350\\u5350allowed_extensions\\u5350\\u5350")
          .join(getExtensionString(instanceInfo.preferences));
        fileData = fileData
          .split("卐卐allowed_extensions卐卐")
          .join(getExtensionString(instanceInfo.preferences));
        fileData = fileData
          .split("\\u5350\\u5350instanceID\\u5350\\u5350")
          .join(instanceInfo.instanceID);
        fileData = fileData
          .split("卐卐instanceID卐卐")
          .join(instanceInfo.instanceID);
        if (instanceInfo.domain === "localhost") {
          fileData = fileData
            .split("\\u5350\\u5350domain\\u5350\\u5350")
            .join(instanceInfo.domain + ":3000");
          fileData = fileData
            .split("卐卐domain卐卐")
            .join(instanceInfo.domain + ":3000");
        } else {
          fileData = fileData
            .split("\\u5350\\u5350domain\\u5350\\u5350")
            .join(instanceInfo.domain);
          fileData = fileData.split("卐卐domain卐卐").join(instanceInfo.domain);
        }
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

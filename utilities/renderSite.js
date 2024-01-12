const fs = require("fs");
const path = require("path");
const { getInstanceInfo } = require("../db");

const renderSite = async (req, res) => {
  let html = "";
  try {
    const instanceID = process.env.DATABASE;
    const hostname = req.hostname;
    const instanceInfo = await getInstanceInfo({ hostname, instanceID });
    html = fs
      .readFileSync(path.join(__dirname, "..", "public", "index.html"))
      .toString();
    html = html
      .split('<link rel="stylesheet" href="卐"/>')
      .map((slice, s) => {
        if (!s) {
          slice = slice.replaceAll(
            '"/',
            '"' + process.env.BUCKET_HOST + "/" + instanceInfo.instanceID + "/"
          );
        }
        return slice;
      })
      .join("");
    html = html.replaceAll(
      "卐卐app_name卐卐",
      instanceInfo.preferences.app_name
    );
    html = html.replaceAll(
      "卐卐description卐卐",
      instanceInfo.preferences.description
    );
    if (req.session.userInfo) {
      req.session.theme = req.session.userInfo.userSettings.theme;
      html += `<p id="user-info-server" class="d-none m-0">${JSON.stringify({
        ...h.returnClientUserInfo(req.session.userInfo),
        unreadMessages: req.session.unreadMessages,
        notifications: req.session.notifications,
        bio: html2json(req.session.userInfo.bio),
      })}</p>`;
    } else html += '<p id="p-metadata" class="d-none m-0"></p>';
    if (!req.session.theme) req.session.theme = "default";
    if (req.session.theme !== "default") {
      html = html.replace(
        "/styles/default.css",
        `/styles/${req.session.theme}.css`
      );
      html = html.replace(
        "/custom-default.css",
        `/custom-${req.session.theme}.css`
      );
    }
  } catch (err) {
    console.log("Error rendering site", err);
  }
  res.status(200).send(html);
};

module.exports = renderSite;

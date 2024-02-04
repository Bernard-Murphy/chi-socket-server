const fs = require("fs");
const path = require("path");
const { getInstanceInfo } = require("../db");
const h = require("./helpers");

const renderSite = async (req, res) => {
  let html = "";
  const hostname = h.parseHost(req.hostname);
  if (!req.session[hostname]) req.session[hostname] = {};
  try {
    const instanceID = process.env.DATABASE;
    const instanceInfo = await getInstanceInfo({ hostname, instanceID });
    html = fs
      .readFileSync(path.join(__dirname, "..", "public", "index.html"))
      .toString();
    html = html
      .split('<link rel="stylesheet" href="卐"/>')
      .map((slice, s) => {
        if (!s) {
          slice = slice
            .split('"/')
            .join(
              '"' +
                process.env.BUCKET_HOST +
                "/" +
                instanceInfo.instanceID +
                "/"
            );
        }
        return slice;
      })
      .join("");
    html = html
      .split("卐卐app_name卐卐")
      .join(instanceInfo.preferences.app_name);
    html = html
      .split("卐卐description卐卐")
      .join(instanceInfo.preferences.description);
    if (req.session[hostname].userInfo) {
      req.session[hostname].theme =
        req.session[hostname].userInfo.userSettings.theme;
      html += `<p id="user-info-server" class="d-none m-0">${JSON.stringify({
        ...h.returnClientUserInfo(req.session[hostname].userInfo),
        unreadMessages: req.session[hostname].unreadMessages,
        notifications: req.session[hostname].notifications,
        bio: html2json(req.session[hostname].userInfo.bio),
      })}</p>`;
    } else html += '<p id="p-metadata" class="d-none m-0"></p>';
    if (!req.session[hostname].theme) req.session[hostname].theme = "default";
    if (req.session[hostname].theme !== "default") {
      html = html.replace(
        "/styles/default.css",
        `/styles/${req.session[hostname].theme}.css`
      );
      html = html.replace(
        "/custom-default.css",
        `/custom-${req.session[hostname].theme}.css`
      );
    }
  } catch (err) {
    console.log("Error rendering site", err);
  }
  res.status(200).send(html);
};

module.exports = renderSite;

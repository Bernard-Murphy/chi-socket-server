const fs = require("fs");
const path = require("path");
const { getInstanceInfo } = require("../db");
const h = require("./helpers");
const crypto = require("crypto");

const renderSite = async (req, res) => {
  let html = "";
  const hostname = h.parseHost(req.hostname);
  if (!req.session[hostname]) req.session[hostname] = {};
  try {
    const instanceInfo = await getInstanceInfo({ hostname });
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

    const metadata = {
      token: crypto
        .publicEncrypt(
          process.env.PUBLIC_KEY,
          JSON.stringify({
            sessionID: req.session.sessionID,
          })
        )
        .toString("hex"),
    };

    if (req.session[hostname].userInfo) {
      req.session[hostname].theme =
        req.session[hostname].userInfo.userSettings.theme;
      metadata.userInfo = {
        ...h.returnClientUserInfo(req.session[hostname].userInfo),
        unreadMessages: req.session[hostname].unreadMessages,
        notifications: req.session[hostname].notifications,
        bio: html2json(req.session[hostname].userInfo.bio),
      };
    }
    html += `<p id="jizzer-metadata" class="d-none m-0 p-0 w-0 h-0 border-none">${JSON.stringify(
      metadata
    )}</p>`;
    if (!req.session[hostname].theme) req.session[hostname].theme = "default";
    metadata.theme = req.session[hostname].theme;
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
  html = html.split("卐").join("");
  res.status(200).send(html);
};

module.exports = renderSite;

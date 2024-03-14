const crypto = require("crypto");
const axios = require("axios");
const { parse: parseHTML } = require("node-html-parser");
const { URL, parse: parseURL } = require("url");
const sanitize = require("sanitize-html");

const h = {};

/**
 * This is the helpers object
 * Contains several commonly used functions in many other files
 */

h.id = () => crypto.randomBytes(8).toString("hex");

h.trimPollData = (emissions, userInfo) =>
  emissions.map((emission) => {
    const voterFilter = (emissionWithPoll) => ({
      ...emissionWithPoll,
      pollData: {
        ...emissionWithPoll.pollData,
        voters: emissionWithPoll.pollData.voters.filter(
          (voter, v) => voter.userID === userInfo?._id || v < 100
        ),
      },
    });

    if (emission.pollData) emission = voterFilter(emission);
    if (emission.signalBoost?.pollData)
      emission.signalBoost = voterFilter(emission.signalBoost);
    if (emission.replyEmission) {
      if (emission.replyEmission.pollData)
        emission.replyEmission = voterFilter(emission.replyEmission);
      if (emission.replyEmission.signalBoost?.pollData)
        emission.replyEmission.signalBoost = voterFilter(
          emission.replyEmission.signalBoost
        );

      if (emission.replyEmission.replyEmission) {
        if (emission.replyEmission.replyEmission.pollData)
          emission.replyEmission.replyEmission = voterFilter(
            emission.replyEmission.replyEmission
          );
        if (emission.replyEmission.replyEmission.signalBoost?.pollData)
          emission.replyEmission.replyEmission.signalBoost = voterFilter(
            emission.replyEmission.replyEmission.signalBoost
          );
      }
    }

    return emission;
  });

h.isNumeric = (string) => {
  /**
   * Determines whether a string is a number. For instance:
   * "3" => true
   * "3.r" => false
   */
  if (typeof string != "string") string = String(string);
  return !isNaN(string) && !isNaN(parseFloat(string));
};

h.returnClientUserInfo = (userInfo, hideIdentifyingInfo) => {
  /**
   * Don't want to return ALL properties (such as password), so use this helper to have a uniform object that will be returned
   * Also makes it easier if properties are added/removed from the Users document
   */
  return {
    username: userInfo.username,
    creationDate: userInfo.creationDate,
    email: hideIdentifyingInfo ? "" : userInfo.email,
    role: userInfo.role,
    userSettings: userInfo.userSettings,
    avatar: userInfo.avatar,
    background: userInfo.background,
    disabled: userInfo.disabled,
    actions: userInfo.actions,
    comments: hideIdentifyingInfo ? "" : userInfo.comments,
    user_id: userInfo.user_id,
    oldUsername: userInfo.oldUsername,
    badge: userInfo.badge,
    bio: userInfo.bio,
    displayName: userInfo.displayName,
    location: userInfo.location,
    website: userInfo.website,
    private: userInfo.private,
    nsfwAccepted: hideIdentifyingInfo ? false : userInfo.nsfwAccepted,
    _id: userInfo._id,
    followers: userInfo.followers,
    following: userInfo.following.length,
    likes: userInfo.likes.length,
    creationDate: userInfo.creationDate,
    ban: userInfo.ban,
    messagesDisabled: userInfo.messagesDisabled,
    live: userInfo.live
      ? {
          timestamp: userInfo.live.timestamp,
          viewers: userInfo.live.viewers,
          streamTitle: userInfo.live.streamTitle,
        }
      : false,
    verified: userInfo.verified,
    boosts: hideIdentifyingInfo ? userInfo.boosts.length : userInfo.boosts,
    deleted: userInfo.deleted,
  };
};

h.getExpirationDate = (expiryUnits, expiryLength) => {
  const expirationDate = new Date();
  switch (expiryUnits) {
    case "hour":
      expirationDate.setHours(expirationDate.getHours() + Number(expiryLength));
      break;
    case "day":
      expirationDate.setDate(expirationDate.getDate() + Number(expiryLength));
      break;
    case "week":
      expirationDate.setDate(
        expirationDate.getDate() + 7 * Number(expiryLength)
      );
      break;
    case "month":
      expirationDate.setMonth(expirationDate.getMonth() + Number(expiryLength));
      break;
    case "year":
      expirationDate.setFullYear(
        expirationDate.getFullYear() + Number(expiryLength)
      );
      break;
    default:
      console.log("oob expiry units", expiryUnits);
  }
  return expirationDate;
};

h.clientUserInfoNone = () => ({
  // This is the default user info sent when the user is not found or not logged in
  userSettings: {
    theme: "default",
  },
  avatar: "blank.webp",
});

/**
 *
 * @param {Number} value - Any number
 *
 * Shortens numbers by compiling them
 * i.e. 1000 bytes -> 1KB
 * 10000 bytes -> 10KB
 *
 *
 * @returns The compiled number
 */
h.compiledNumber = (value) => {
  value = Number(value);
  if (value > 1000000000) return String((value / 1000000000).toFixed(1)) + "B";
  else if (value > 1000000) return String((value / 1000000).toFixed(1)) + "M";
  else if (value > 1000) return String((value / 1000).toFixed(1)) + "K";
  return value;
};

h.verifyCaptcha = (token) => {
  /* This is the function that the main image upload form waits on while the user's reCaptcha challenge is verified. 
    It makes a request to Google's server using the address provided, then if it returns a successful response, it will return success and vice-versa. */
  return new Promise((resolve, reject) => {
    if (process.env.DATABASE.includes("test")) return resolve(true);
    const body = {
      event: {
        token: token,
        siteKey: process.env.CAPTCHA_SITE_KEY,
        expectedAction: "login",
      },
    };
    axios
      .post(
        `https://recaptchaenterprise.googleapis.com/v1/projects/${process.env.CAPTCHA_PROJECT_ID}/assessments?key=${process.env.CAPTCHA_API_KEY}`,
        body
      )
      .then((response) => {
        console.log("captcha", response?.data?.riskAnalysis?.score);
        if (response.data.riskAnalysis.score > 0.2) resolve(true);
        else {
          console.log(response.data);
          reject("Human verification failed");
        }
      })
      .catch((err) => {
        console.log("err", err);
        reject("Human verification failed");
      });
  });
};

h.checkJanny = (req, host) => {
  /**
   * Checks to see whether the user is an administrator
   */
  if (
    req.session &&
    req.session[host].userInfo &&
    ["Chadmin", "Janny"].indexOf(req.session[host].userInfo.role) !== -1 &&
    !req.session[host].userInfo.disabled
  )
    return true;
  else return false;
};

h.checkJanny_userInfo = (userInfo) => {
  /**
   * Checks to see whether the user is an administrator
   */
  if (
    userInfo &&
    ["Chadmin", "Janny"].indexOf(userInfo.role) !== -1 &&
    !userInfo.disabled
  )
    return true;
  else return false;
};

h.checkChadmin_userInfo = (userInfo) => {
  /**
   * Checks to see whether the user is an administrator
   */
  if (userInfo && userInfo.role === "Chadmin" && !userInfo.disabled)
    return true;
  else return false;
};

// Same as the checkChadmin middleware, but a regular method
h.checkChadmin = (req, host) => {
  if (
    req.session &&
    req.session[host].userInfo &&
    req.session[host].userInfo.role === "Chadmin" &&
    !req.session[host].userInfo.disabled
  )
    return true;
  else return false;
};

/**
 *
 * @param {String} url - A url to be checked
 * Parse the url, create a URL using the constructor
 * Will break if it fails
 * @returns Boolean - whether or not the string is a valid url
 */
h.checkValidURL = (url) => {
  try {
    const parsed = parseURL(url);
    if (!parsed.protocol) url = "https://" + url;
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 *
 * @param {String} html - HTML string
 * @returns The length of the regular text in the string sans whitespace that is not a space or new line
 */
h.checkHTMLLength = (html) =>
  String(parseHTML(html).textContent)
    .split("")
    .filter((c) => {
      const checkWhiteSpace = c.match(/[\s]/);
      if (!checkWhiteSpace) return true;
      else {
        return [" ", "\n"].indexOf(c) > -1;
      }
    }).length;

h.parseHost = (host) =>
  host
    .replace("http://", "")
    .replace("https://", "")
    .split(":")[0]
    .split("/")[0]
    .toLowerCase()
    .split(".")
    .join("卐");

/**
 *
 * @param {String} html - HTML string
 *
 * If an html string that is not properly parsed (class names wrong, etc), this function will fix it
 *
 * @returns HTML string that is properly parsed
 */
h.parseStrayTags = (html) => {
  if (html.includes("卐")) {
    return "<p><br></p>";
  }
  html = html.replace(/[\u200B-\u200F\uFEFF]/g, "");
  let parsedHTML = parseHTML(html);

  // Regular links
  Array.from(parsedHTML.getElementsByTagName("a"))
    .filter((link) => ["#", "@"].indexOf(link.textContent[0]) === -1)
    .forEach(
      (link) =>
        (link.textContent = `卐卐卐卐${link.getAttribute("href")}卐 卐卐${
          link.textContent
        }卐卐 卐`)
    ); // Swastikas are illegal characters. That's why I use them to parse links
  let updatedHTML = parsedHTML.textContent;
  updatedHTML = updatedHTML.split("卐卐卐卐");

  for (let u = 0; u < updatedHTML.length; u++) {
    const slice = updatedHTML[u];
    if (slice.includes("卐 卐卐")) {
      const href = slice.split("卐 卐卐")[0];
      const text = slice.split("卐 卐卐")[1].split("卐卐 卐")[0];
      updatedHTML[
        u
      ] = `<a class="text-blue text-decoration-none" href="${href}">${text}</a>${
        slice.split("卐卐 卐")[1]
      }`;
    }
  }
  updatedHTML = updatedHTML.join("");

  updatedHTML = updatedHTML.split("");
  // Hashtags/mentions
  updatedHTML.forEach((char, c) => {
    if (
      char === "#" &&
      updatedHTML[c + 1] &&
      ["@", "#", "\n", " "].indexOf(updatedHTML[c + 1]) === -1
    ) {
      updatedHTML[c] = "卐卐HASH卐";
      let index = c + 1;
      let endFound = false;
      while (!endFound) {
        if (
          !updatedHTML[index + 1] ||
          ["@", "#", "\n", " "].indexOf(updatedHTML[index + 1]) > -1
        ) {
          updatedHTML[index] = updatedHTML[index] + "卐HASH卐卐";
          endFound = true;
        }
        index++;
      }
    }
    if (
      char === "@" &&
      updatedHTML[c + 1] &&
      ["@", "#", "\n", " "].indexOf(updatedHTML[c + 1]) === -1
    ) {
      updatedHTML[c] = "卐卐MENTION卐";
      let index = c + 1;
      let endFound = false;
      while (!endFound) {
        if (
          !updatedHTML[index + 1] ||
          ["@", "#", "\n", " "].indexOf(updatedHTML[index + 1]) > -1
        ) {
          updatedHTML[index] = updatedHTML[index] + "卐MENTION卐卐";
          endFound = true;
        }
        index++;
      }
    }
  });

  updatedHTML = updatedHTML.join("");

  updatedHTML = updatedHTML.split("卐卐HASH卐");
  for (let u = 0; u < updatedHTML.length; u++) {
    const slice = updatedHTML[u];
    if (slice.includes("卐HASH卐卐")) {
      const text = slice.split("卐HASH卐卐")[0];
      updatedHTML[
        u
      ] = `<a class="text-secondary" href="/tag/${text}">#${text}</a>${
        slice.split("卐HASH卐卐")[1]
      }`;
    }
  }
  updatedHTML = updatedHTML.join("");

  updatedHTML = updatedHTML.split("卐卐MENTION卐");
  for (let u = 0; u < updatedHTML.length; u++) {
    const slice = updatedHTML[u];
    if (slice.includes("卐MENTION卐卐")) {
      const text = slice.split("卐MENTION卐卐")[0];
      updatedHTML[u] = `<a class="text-success" href="/${text}">@${text}</a>${
        slice.split("卐MENTION卐卐")[1]
      }`;
    }
  }
  updatedHTML = updatedHTML.join("");

  return updatedHTML;
};

/**
 *
 * @param {String} html - HTML string
 * @returns HTML with only approved tags, classes, and attributes
 */
h.sanitizeHTML = (html) => {
  while (html.split("<p><br></p><p><br></p>").length > 1)
    html = html.split("<p><br></p><p><br></p>").join("<p><br></p>");
  html = h.parseStrayTags(html);
  while (html.split("  ").length > 1) html = html.split("  ").join(" ");
  while (html.split("\n\n").length > 1) html = html.split("\n\n").join("\n");
  while (html.split(" \n").length > 1) html = html.split(" \n").join("\n");
  const clean = sanitize(html, {
    allowedTags: ["a", "br", "p", "div", "span"],
    allowedAttributes: {
      a: ["href", "class"],
      br: [],
      p: [],
      div: [],
      span: [],
    },
    allowedClasses: {
      a: [
        "text-success",
        "text-secondary",
        "text-blue",
        "text-decoration-none",
        "ql-mention",
        "ql-hashtag",
      ],
      br: [],
      p: [],
      div: [],
      span: [],
    },
  });
  return clean;
};

/**
 *
 * @param {Socket} io - Socket.io socket object
 * @param {Object} emission - Emissions document
 * @returns Array of User _ids of users that like the emission
 */
h.getUserLikes = (io, emission, host) => {
  return Object.keys(io.engine.clients)
    .filter((key) => {
      return (
        io.engine.clients[key]?.request?.session &&
        io.engine.clients[key].request.session[host]?.userInfo?.likes?.indexOf(
          emission.emissionID
        ) > -1
      );
    })
    .map((key) => io.engine.clients[key].request.session[host].userInfo._id);
};

h.getUsersAffected = (sessionsAffected, host) => {
  const usersAffected = [];

  sessionsAffected.forEach((s) => {
    if (s.session[host].userInfo) {
      if (
        !usersAffected.find(
          (u) =>
            u.session[host].userInfo &&
            u.session[host].userInfo._id === s.session[host].userInfo._id
        )
      )
        usersAffected.push(s);
    } else {
      if (
        !usersAffected.find(
          (u) => u.session[host].tempID === s.session[host].tempID
        )
      )
        usersAffected.push(s);
    }
  });

  return usersAffected;
};

/**
 *
 * @param {String} string - Any string
 * @returns Object with an array of mentions if any, and an array of hashtags if any
 */
h.getHashtagsMentions = (string) => {
  const mentionRegex = /\B@[a-z0-9_-]+/gi;
  const hashtagRegex = /\B#[a-z0-9_-]+/gi;
  const mentions = string.match(mentionRegex);
  const hashtags = string.match(hashtagRegex);
  return {
    mentions: mentions
      ? [...new Set(mentions.map((m) => m.split("@")[1]))]
      : false,
    hashtags: hashtags
      ? [...new Set(hashtags.map((m) => m.split("#")[1]))]
      : false,
  };
};

module.exports = h;

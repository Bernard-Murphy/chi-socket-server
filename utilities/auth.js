const router = require("express").Router();
const a = require("./asyncHelpers");
const c = require("./longCalls");
const h = require("./helpers");
const auth = require("../middlewares/auth");
const {
  change_password_uuid_schema,
  forgot_password_schema,
  login_schema,
  user_schema,
} = require("./validations");
const bcrypt = require("bcrypt");
const { v4: uuid } = require("uuid");
const path = require("path");
const { parse } = require("node-html-parser");
const axios = require("axios");
const crypto = require("crypto");
const { client } = require("../db");

const allowedImageExtensions = [
  ".png",
  ".jpeg",
  ".jpg",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
];

// Placeholder. Not currently used.
router.get("/nsfw-accept", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    req.session[req.hostname].nsfwAccepted = true;
    if (req.session[req.hostname].userInfo)
      await db.collection("users").updateOne(
        {
          _id: req.session[req.hostname].userInfo._id,
        },
        {
          $set: {
            nsfwAccepted: true,
          },
        }
      );
    res.redirect("/auth/check-user");
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Hit when the user toggles dark mode
 *
 * Updates their session and their Users document
 */
router.get("/toggle-dark-mode", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    req.session[req.hostname].theme =
      req.session[req.hostname].theme === "default" ? "dark" : "default";
    if (
      req.session[req.hostname].userInfo &&
      req.session[req.hostname].userInfo.username
    ) {
      await db.collection("users").updateOne(
        {
          username: req.session[req.hostname].userInfo.username,
        },
        {
          $set: {
            "userSettings.theme": req.session[req.hostname].theme,
          },
        }
      );
      req.session[req.hostname].userInfo.userSettings.theme =
        req.session[req.hostname].theme;
    }
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Hit when the user registers a new account
 *
 * Validate request body
 * Sanitize bio html
 * Validate the Captcha
 * Check for duplicate username/email
 * Hash and salt password
 * Process avatar/background if applicable
 * Insert new user
 * If manual approval of accounts is required, create a new report requesting approval, and notify all users with janny privileges
 * Insert SearchBlob
 * If there are mentions in the bio, notify users who were mentioned
 * If email verification required, create new Verifications document and email the user with the link to verify
 *
 * Request body
 * {
 * bio: String - HTML of bio
 * captchaKey: String - Google reCaptcha v3 enterprise key
 * email: String - User email
 * password1: String - Plaintext password
 * password2: Same as password1
 * username: String - User's username
 * displayName: String - User's display name
 * website: String - User's website
 * location: String - User's location
 * }
 */
router.post("/create_account", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    user_schema.validateSync(req.body);
    const id = crypto.randomBytes(8).toString("hex");
    try {
      req.body.bio = h.sanitizeHTML(req.body.bio);
      const flags = h.getHashtagsMentions(req.body.bio);
      if (h.checkHTMLLength(req.body.bio) > 1000) throw "Bio is too long";

      const captchaCheck = await h.verifyCaptcha(req.body.captchaKey);
      if (!captchaCheck)
        throw "Human verification failed. Refresh the page and try again.";

      const checkUsername = await db.collection("users").findOne({
        username: new RegExp(`^${req.body.username}$`, "i"),
      });
      if (checkUsername) throw "That username is already taken";

      const checkEmail = await db.collection("users").findOne({
        email: new RegExp(`^${req.body.email}$`, "i"),
      });
      if (checkEmail) throw "That email is already in use";

      const passHash = await bcrypt.hash(req.body.password1, 8);
      if (!req.session[req.hostname].nsfwAccepted)
        req.session[req.hostname].nsfwAccepted = false;

      let avatar = {
        main: "blank-avatar.png",
        thumbnail: "blank-avatar.png",
      };
      let background = {
        main: "default-background.webp",
        thumbnail: "default-background.webp",
      };

      if (req.files) {
        if (req.files.avatar) {
          if (
            req.files.avatar.size > Number(process.env.MAX_INDIVIDUAL_FILE_SIZE)
          )
            throw "Avatar too big - already checked on client";
          if (
            allowedImageExtensions.indexOf(
              path.extname(req.files.avatar.name).toLowerCase()
            ) === -1
          )
            throw "File extension not allowed";
          avatar = await h.processFile(req.files.avatar);
        }
        if (req.files.background) {
          if (
            req.files.background.size >
            Number(process.env.MAX_INDIVIDUAL_FILE_SIZE)
          )
            throw "Background too big - already checked on client";
          if (
            allowedImageExtensions.indexOf(
              path.extname(req.files.background.name).toLowerCase()
            ) === -1
          )
            throw "File extension not allowed";
          background = await h.processFile(req.files.background);
        }
      }

      if (!h.checkValidURL(req.body.website)) req.body.website = "";

      const user_id = await db.collection("hrIDs").findOneAndUpdate(
        {},
        {
          $inc: {
            user_id: 1,
          },
        },
        {
          returnDocument: "after",
        }
      );
      const newUser = {
        _id: id,
        user_id: user_id.value.user_id,
        username: req.body.username,
        password: passHash,
        creationDate: new Date(),
        email: req.body.email,
        role: "Child",
        userSettings: {
          theme: req.session[req.hostname].theme
            ? req.session[req.hostname].theme
            : "default",
        },
        avatar: avatar,
        background: background,
        disabled: false,
        actions: [],
        comments: "",
        bio: req.body.bio,
        bioText: parse(req.body.bio).textContent,
        displayName: req.body.displayName,
        website: req.body.website,
        location: req.body.location,
        badge: false,
        private: false,
        nsfwAccepted: req.session[req.hostname].nsfwAccepted,
        followers: 0,
        following: [],
        likes: [],
        ban: {
          banned: false,
          reason: false,
          user: false,
          details: false,
        },
        blocked: [],
        verified: false,
        emailValidated: process.env.EMAIL_VERIFICATION_REQUIRED !== "true",
        approved: process.env.REQUIRE_APPROVAL !== "true",
        headers: req.headers,
        boosts: [],
      };
      await db.collection("users").insertOne(newUser);
      if (
        process.env.EMAIL_VERIFICATION_REQUIRED !== "true" &&
        process.env.REQUIRE_APPROVAL !== "true"
      )
        req.session[req.hostname].userInfo = newUser;

      if (process.env.REQUIRE_APPROVAL === "true") {
        await db.collection("reports").insertOne({
          _id: id,
          timestamp: new Date(),
          type: "approval",
          userID: newUser._id,
          dismissed: false,
          seenBy: [],
        });
        const jannySessions = await client
          .db("sessionServer")
          .collection("sessions")
          .find({
            [`session${[req.hostname]}.userInfo.role`]: {
              $in: ["Chadmin", "Janny"],
            },
          })
          .toArray();
        const reports = await db
          .collection("reports")
          .find({
            dismissed: false,
          })
          .toArray();
        let open = [
          ...new Set(
            reports
              .filter((r) => r.type === "emission")
              .map((r) => r.emissionID)
          ),
          ...new Set(
            reports.filter((r) => r.type === "user").map((r) => r.user_id)
          ),
          ...reports.filter((r) => r.type === "approval"),
        ];
        [
          ...new Set(
            jannySessions.map((s) => s.session[req.hostname].userInfo.username)
          ),
        ].forEach((username) =>
          io
            .to(username.toLowerCase() + "-self")
            .emit("report-count", open.length)
        );
      }

      const blobID = crypto.randomBytes(8).toString("hex");
      await db.collection("searchBlobs").insertOne({
        _id: blobID,
        type: "user",
        userID: newUser._id,
        username: newUser.username,
        displayName: newUser.displayName,
        bioText: newUser.bioText,
        location: newUser.location,
        website: newUser.website,
      });

      if (flags.mentions) {
        const usersToNotify = await db
          .collection("users")
          .find({
            username: {
              $in: flags.mentions
                .filter(
                  (m) =>
                    m.toLowerCase() !==
                    req.session[req.hostname].userInfo.username.toLowerCase()
                )
                .map((mention) => new RegExp(`^${mention}$`, "i")),
            },
          })
          .toArray();
        for (let m = 0; m < usersToNotify.length; m++) {
          const user = usersToNotify[m];
          const notificationID = crypto.randomBytes(8).toString("hex");
          await db.collection("notifications").insertOne({
            _id: notificationID,
            type: "mention",
            unread: true,
            lastInteraction: new Date(),
            userID: user._id,
            mentioner: req.session[req.hostname].userInfo.username,
            interactions: [
              {
                timestamp: new Date(),
                userID: req.session[req.hostname].userInfo._id,
              },
            ],
          });
          const notificationToSend = await c.getNotification(notificationID);
          io.to(user._id).emit("notification", notificationToSend);
        }
      }

      if (process.env.EMAIL_VERIFICATION_REQUIRED === "true") {
        const validationID = uuid();
        axios
          .post(process.env.EMAIL_SERVER + "/emails/verification", {
            emailKey: process.env.EMAIL_KEY,
            appName: process.env.APP_NAME,
            email: req.body.email,
            username: req.body.username,
            validationID: validationID,
            root: process.env.ROOT,
            instanceID: process.env.INSTANCE_ID,
          })
          .then(async () => {
            const id = crypto.randomBytes(8).toString("hex");
            await db.collection("validations").insertOne({
              _id: id,
              timestamp: new Date(),
              validationID: validationID,
              userID: newUser._id,
              email: newUser.email,
              valid: true,
            });
            res.status(200).json({
              timestamp: new Date(),
              email: req.body.email,
            });
          })
          .catch((err) => {
            console.log("email server error", err);
            res.status(200).json({
              error:
                "There was an error generating the reset email. Please try again later.",
            });
          });
      } else if (process.env.REQUIRE_APPROVAL === "true") res.sendStatus(200);
      else
        res.status(200).json(
          h.returnClientUserInfo({
            ...newUser,
            nsfwAccepted: req.session[req.hostname].nsfwAccepted,
          })
        );
    } catch (err) {
      console.log(err);
      res.status(200).json({
        error: err,
      });
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Hit when the user clicks the link that was emailed to them to verify their account
 *
 * Flags their account as validated
 * If manual approval is also required and user is not approved, sendStatus 200
 * Else set session userInfo to user
 */
router.get("/validate/:id", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    const validation = await db.collection("validations").findOne({
      validationID: req.params.id,
      valid: true,
    });
    if (!validation) res.sendStatus(404);
    else {
      const user = await db.collection("users").findOneAndUpdate(
        {
          _id: validation.userID,
        },
        {
          $set: {
            emailValidated: true,
          },
        }
      );
      if (!user.value) res.sendStatus(404);
      else {
        if (process.env.REQUIRE_APPROVAL === "true" && !user.value.approved)
          res.sendStatus(200);
        else {
          req.session[req.hostname].nsfwAccepted = user.value.nsfwAccepted;
          req.session[req.hostname].userInfo = user.value;
          req.session[req.hostname].theme = user.value.userSettings.theme;
          res.status(200).json({
            ...h.returnClientUserInfo({
              ...user.value,
              nsfwAccepted: user.value.nsfwAccepted,
            }),
          });
        }
      }
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

router.get("/delete-cancel-action/:id", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    await db.collection("deleteRequests").updateOne(
      {
        requestID: req.params.id,
      },
      {
        $set: {
          cancelled: true,
        },
      }
    );
    res.sendStatus(200);
  } catch (err) {
    console.log("Delete cancel error", req.params.id, err);
    res.sendStatus(500);
  }
});

router.get("/delete-confirm/:id", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    const deletionRequest = await db.collection("deleteRequests").findOne({
      requestID: req.params.id,
    });
    if (!deletionRequest) return res.sendStatus(404);
    else if (deletionRequest && new Date(deletionRequest.expires) < new Date())
      return res.sendStatus(410);
    else if (deletionRequest.cancelled) return res.sendStatus(400);

    await db.collection("deleteRequests").updateOne(
      {
        _id: deletionRequest._id,
      },
      {
        $set: {
          expires: new Date(),
        },
      }
    );

    const userToDelete = await db.collection("users").findOne({
      _id: deletionRequest.userID,
    });
    if (!userToDelete) return res.sendStatus(404);
    io.to(userToDelete._id).emit(
      "delete-self",
      h.returnClientUserInfo(userToDelete, true)
    );
    await db.collection("deletedUsers").insertOne({
      ...userToDelete,
      deletionDate: new Date(),
    });
    await db.collection("users").updateMany(
      {
        followers: userToDelete.user_id,
      },
      {
        $pull: {
          followers: userToDelete.user_id,
        },
      }
    );
    await db.collection("searchBlobs").deleteMany({ userID: userToDelete._id });
    await db.collection("users").updateOne(
      {
        _id: userToDelete._id,
      },
      {
        $set: {
          role: "Child",
          avatar: {
            main: "blank-avatar.png",
            thumbnail: "blank-avatar.png",
          },
          background: {
            main: "default-background.webp",
            thumbnail: "default-background.webp",
          },
          deleted: true,
          disabled: true,
          actions: userToDelete.actions
            ? [
                ...userToDelete.actions,
                {
                  action: "User deleted account",
                  timestamp: new Date(),
                },
              ]
            : [
                {
                  action: "User deleted account",
                  timestamp: new Date(),
                },
              ],
          comments: "",
          bio: "<div><p></p></div>",
          bioText: "",
          displayName: "Deleted User",
          website: "",
          location: "",
          badge: false,
          private: false,
          nsfwAccepted: false,
          followers: 0,
          following: [],
          likes: [],
          ban: {
            banned: false,
            reason: false,
            user: false,
            details: false,
          },
          blocked: [],
          emailValidated: false,
          approved: false,
          headers: userToDelete.headers,
          live: false,
          verified: false,
          boosts: [],
        },
      }
    );
    await db.collection("reports").updateMany(
      {
        $or: [
          {
            user_id: userToDelete.user_id,
          },
          {
            poster: userToDelete._id,
          },
        ],
      },
      {
        $set: {
          dismissed: true,
        },
      }
    );
    const chadminSessions = await client
      .db("sessionServer")
      .collection("sessions")
      .find({
        [`session${[req.hostname]}.userInfo.role`]: "Chadmin",
      })
      .toArray();
    [
      ...new Set(
        chadminSessions.map((s) => s.session[req.hostname].userInfo._id)
      ),
    ].forEach((userID) => io.to(userID).emit("new-mod-log"));

    const jannySessions = await client
      .db("sessionServer")
      .collection("sessions")
      .find({
        [`session${[req.hostname]}.userInfo.role`]: {
          $in: ["Chadmin", "Janny"],
        },
      })
      .toArray();
    const reports = await db
      .collection("reports")
      .find({ dismissed: false })
      .toArray();
    let open = [
      ...new Set(
        reports.filter((r) => r.type === "emission").map((r) => r.emissionID)
      ),
      ...new Set(
        reports.filter((r) => r.type === "user").map((r) => r.user_id)
      ),
      ...reports.filter((r) => r.type === "approval"),
    ];
    [
      ...new Set(
        jannySessions.map((s) => s.session[req.hostname].userInfo._id)
      ),
    ].forEach((userID) => io.to(userID).emit("report-count", open.length));

    let allEmissionsRemoved = false;
    const emissionsDeleted = [];

    while (!allEmissionsRemoved) {
      try {
        const emissions = await db
          .collection("emissions")
          .find(
            {
              emissionID: {
                $nin: emissionsDeleted,
              },
              userID: userToDelete._id,
              deleted: {
                $ne: true,
              },
            },
            {
              $limit: 1000,
            }
          )
          .toArray();
        for (let e = 0; e < emissions.length; e++) {
          try {
            const emission = emissions[e];
            await db.collection("deletedEmissions").insertOne(emission);
            await db.collection("searchBlobs").deleteMany({
              emissionID: emission._id,
            });
            await db.collection("users").updateMany(
              {
                $or: [
                  {
                    likes: emission.emissionID,
                  },
                  {
                    "boosts.boostID": emission.emissionID,
                  },
                ],
              },
              {
                $pull: {
                  boosts: {
                    boostID: emission.emissionID,
                  },
                  likes: emission.emissionID,
                },
              }
            );
            await db.collection("emissions").updateOne(
              {
                _id: emission._id,
              },
              {
                $set: {
                  signalBoost: false,
                  files: false,
                  html: `<div><h5 class="text-center my-4 display-6">@${userToDelete.username} has deleted their account.</h5></div>`,
                  text: `@${userToDelete.username} has deleted their account.`,
                  pollID: false,
                  likes: 0,
                  signalBoosts: 0,
                  remove: {
                    removed: true,
                    reason: "Other",
                    details: `@${userToDelete.username} has deleted their account`,
                    user: {
                      username: userToDelete.username,
                      userID: userToDelete._id,
                    },
                    timestamp: new Date(),
                  },
                  replies: 0,
                  views: 0,
                  tags: [],
                  pinned: false,
                  deleted: true,
                },
              }
            );
            emissionsDeleted.push(emission.emissionID);
          } catch (err) {
            console.log("delete emissions error", err);
          }
        }
        if (emissions.length < 1000) allEmissionsRemoved = true;
      } catch (err) {
        console.log("Deleting emissions error", err);
      }
    }
    const sessionsAffected = await client
      .db("sessionServer")
      .collection("sessions")
      .find({
        $or: [
          {
            [`session${[req.hostname]}.emissionsCollected`]: {
              $in: emissionsDeleted,
            },
          },
          {
            [`session${[req.hostname]}.userMessageIDs`]: userToDelete._id,
          },
          {
            [`session${[req.hostname]}.profile`]: userToDelete._id,
          },
        ],
        $or: [
          { [`session${[req.hostname]}.tempID`]: { $ne: null } },
          { [`session${[req.hostname]}.userInfo`]: { $ne: null } },
        ],
      })
      .toArray();
    let usersAffected = [];
    sessionsAffected.forEach((s) => {
      if (s.session[req.hostname].userInfo) {
        if (
          !usersAffected.find(
            (u) =>
              u.session[req.hostname].userInfo &&
              u.session[req.hostname].userInfo._id ===
                s.session[req.hostname].userInfo._id
          )
        )
          usersAffected.push(s);
      } else {
        if (
          !usersAffected.find(
            (u) =>
              u.session[req.hostname].tempID === s.session[req.hostname].tempID
          )
        )
          usersAffected.push(s);
      }
    });
    usersAffected.forEach((user) => {
      if (user.session[req.hostname].userInfo)
        io.to(user.session[req.hostname].userInfo._id).emit(
          "account-deleted",
          userToDelete._id
        );
      else
        io.to(user.session[req.hostname].tempID).emit(
          "account-deleted",
          userToDelete._id
        );
    });

    const theme = userToDelete.userSettings.theme;
    req.session[req.hostname].userInfo = null;
    await db.collection("sessions").deleteMany({
      [`session${[req.hostname]}.userInfo._id`]: userToDelete._id,
    });
    res.redirect(`/auth/init/${theme}`);
  } catch (err) {
    console.log("Delete confirm error", req.params.id, err);
    res.sendStatus(500);
  }
});

router.get("/delete-account", auth.checkLoggedIn, async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    if (req.session[req.hostname].userInfo.user_id === 1)
      return res.sendStatus(400);
    const user = await db
      .collection("users")
      .findOne({ _id: req.session[req.hostname].userInfo._id });
    if (!user) return res.sendStatus(404);

    await db.collection("deleteRequests").updateMany(
      {
        userID: req.session[req.hostname].userInfo._id,
      },
      {
        $set: {
          expires: new Date(new Date().setDate(new Date().getDate() - 5)),
        },
      }
    );
    const requestID = uuid();
    const request = {
      _id: crypto.randomBytes(8).toString("hex"),
      userID: req.session[req.hostname].userInfo._id,
      requestID: requestID,
      expires: new Date(new Date().setDate(new Date().getDate() + 3)),
    };
    await db.collection("deleteRequests").insertOne(request);
    const postBody = {
      emailKey: process.env.EMAIL_KEY,
      appName: process.env.APP_NAME,
      email: user.email,
      username: user.username,
      requestID: requestID,
      root: process.env.ROOT,
      instanceID: process.env.INSTANCE_ID,
      emissionPlural: process.env.EMISSION_PLURAL,
    };
    await axios.post(
      process.env.EMAIL_SERVER + "/emails/delete-account",
      postBody
    );
    res.status(200).json({
      email: user.email,
    });
  } catch (err) {
    console.log("Delete account error", err);
    res.sendStatus(500);
  }
});

/**
 * Hit when the user requests a new verification email
 *
 * Checks to see that previous verification exists and is more than a minute old
 * Invalidate all verifications with this email, then insert a new one
 *
 * Request Body
 * {
 * email: String - User's email address
 * }
 */
router.post("/resend-verification", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    let check = await db
      .collection("validations")
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userID",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        {
          $unwind: "$userInfo",
        },
        {
          $match: {
            email: req.body.email,
            valid: true,
          },
        },
        {
          $project: {
            _id: 1,
            email: 1,
            valid: 1,
            userInfo: "$userInfo",
            timestamp: 1,
            validationID: 1,
            userID: 1,
          },
        },
      ])
      .toArray();
    if (
      check.length &&
      new Date(new Date().setMinutes(new Date().getMinutes() - 1)) >
        new Date(check[0].timestamp)
    ) {
      check = check[0];
      const validationID = uuid();
      axios
        .post(process.env.EMAIL_SERVER + "/emails/verification", {
          emailKey: process.env.EMAIL_KEY,
          appName: process.env.APP_NAME,
          email: req.body.email,
          username: check.userInfo.username,
          validationID: validationID,
          root: process.env.ROOT,
          instanceID: process.env.INSTANCE_ID,
        })
        .then(async () => {
          await db.collection("validations").updateMany(
            {
              email: req.body.email,
            },
            {
              $set: {
                valid: false,
              },
            }
          );
          const verificationID = crypto.randomBytes(8).toString("hex");
          await db.collection("validations").insertOne({
            _id: verificationID,
            timestamp: new Date(),
            validationID: validationID,
            userID: check.userID,
            email: req.body.email,
            valid: true,
          });
          res.status(200).json({
            timestamp: new Date(),
            email: req.body.email,
          });
        })
        .catch((err) => {
          console.log("email server error", err);
          res.sendStatus(500);
        });
    } else res.sendStatus(404);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Hit when the user logs out from anywhere
 *
 * Logout only if the user is already logged in otherwise the user can hit this to reset their login lockout cooldown from unsuccessful login attempts
 * Redirect to /init/:theme once complete
 */
router.get("/logout", async (req, res) => {
  try {
    if (req.session[req.hostname] && req.session[req.hostname].userInfo) {
      const theme = req.session[req.hostname].userInfo.userSettings.theme;
      req.session[req.hostname].userInfo = null;
      res.redirect(`/auth/init/${theme}`);
    } else res.sendStatus(401);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Hit after the user logs out
 * Keeps the user's theme from before they logged out
 * Assigns a temp ID so websocket can initialize properly
 */
router.get("/init/:theme", async (req, res) => {
  try {
    req.session[req.hostname].tempID = crypto.randomBytes(8).toString("hex");
    req.session[req.hostname].theme = req.params.theme;
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

router.get("/splash", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    console.log(req.hostname);
    const token = crypto
      .publicEncrypt(
        process.env.PUBLIC_KEY,
        JSON.stringify({
          instanceID: process.env.DATABASE,
          sessionID: req.session[req.hostname].sessionID,
        })
      )
      .toString("binary");
    let unreadMessages = 0;
    let notifications = 0;
    if (req.session[req.hostname].userInfo) {
      const user = await db
        .collection("users")
        .findOne({ _id: req.session[req.hostname].userInfo._id });
      if (user.disabled) req.session[req.hostname].userInfo = null;
      else {
        req.session[req.hostname].nsfwAccepted = user.nsfwAccepted;
        req.session[req.hostname].userInfo = user;
        req.session[req.hostname].theme = user.userSettings.theme;
        const conversations = await db
          .collection("conversations")
          .find({
            parties: req.session[req.hostname].userInfo._id,
            "messages.read": false,
          })
          .toArray();
        unreadMessages = conversations.reduce(
          (prev, curr) =>
            prev +
            curr.messages.filter(
              (m) =>
                m.author !== req.session[req.hostname].userInfo._id && !m.read
            ).length,
          0
        );
        notifications = await db.collection("notifications").countDocuments({
          userID: req.session[req.hostname].userInfo._id,
          unread: true,
        });
      }
    }
    req.session[req.hostname].notifications = notifications;
    req.session[req.hostname].unreadMessages = unreadMessages;
    req.session[req.hostname].emissionsCollected = [];
    res.status(200).json({
      userInfo: req.session[req.hostname].userInfo
        ? {
            ...h.returnClientUserInfo(req.session[req.hostname].userInfo),
            unreadMessages: req.session[req.hostname].unreadMessages,
            notifications: req.session[req.hostname].notifications,
          }
        : false,
      token: token,
    });
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Hit when the user logs in from anywhere
 *
 * If the user is on cooldown, but the cooldown has expired, delete the cooldown and reset login attempts
 * If the user is not on cooldown but has 4 or more failed attempts, put user on cooldown
 * Validate request body
 * Check that user exists
 * Check that password is valid
 * Check that user is not disabled
 * If email verification is required, check that email is verified
 * Check that user was not rejected
 * If manual approval required, check that user was manually approved
 * If user is logging in from a login modal on a profile page, fetch profile info with new user info
 * If user is logging in from a login modal on an emission page, fetch emission info with new user info
 * Return 200
 *
 * Request Body
 * {
 * username: String - The user's username
 * password: String - The user's plaintext password
 * captchaKey: String - Google reCaptcha v3 enterprise client key
 * }
 */
router.post("/login", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    if (
      req.session[req.hostname] &&
      req.session[req.hostname].lockoutCooldown &&
      new Date() > new Date(req.session[req.hostname].lockoutCooldown)
    ) {
      delete req.session[req.hostname].lockoutCooldown;
      req.session[req.hostname].loginAttempts = 0;
    }
    if (
      req.session[req.hostname] &&
      req.session[req.hostname].loginAttempts &&
      req.session[req.hostname].loginAttempts >= 4
    ) {
      req.session[req.hostname].lockoutCooldown = new Date(
        new Date().getTime() + 20 * 60 * 1000
      );
      res.status(403).json({
        message: "You are locked out from too many unsuccessful login attempts",
      });
    } else {
      login_schema.validateSync(req.body);
      const captchaCheck = await h.verifyCaptcha(req.body.captchaKey);
      const user = await db.collection("users").findOne({
        username: new RegExp(`^${req.body.username}$`, "i"),
      });
      if (!(user && captchaCheck)) {
        if (
          req.session[req.hostname].loginAttempts &&
          !req.session[req.hostname].lockoutCooldown
        )
          req.session[req.hostname].loginAttempts++;
        else req.session[req.hostname].loginAttempts = 1;
        res.sendStatus(401);
      } else {
        const check = await bcrypt.compareSync(
          req.body.password,
          user.password
        );
        if (!check) {
          if (
            req.session[req.hostname].loginAttempts &&
            !req.session[req.hostname].lockoutCooldown
          )
            req.session[req.hostname].loginAttempts++;
          else req.session[req.hostname].loginAttempts = 1;
          res.sendStatus(401);
        } else {
          if (user.disabled)
            res.status(403).json({
              message:
                "Your account is disabled. Please contact an administrator.",
            });
          else if (
            process.env.EMAIL_VERIFICATION_REQUIRED === "true" &&
            !user.emailValidated
          ) {
            const validation = await db.collection("validations").findOne({
              userID: user._id,
              valid: true,
            });
            res.status(423).json({
              timestamp: validation.timestamp,
              email: validation.email,
            });
          } else if (user.rejected)
            res.status(403).json({
              message:
                "Your account was reviewed and rejected by an administrator.",
            });
          else if (process.env.REQUIRE_APPROVAL === "true" && !user.approved)
            res.status(403).json({
              message:
                "Your account is awaiting approval. Please try again later.",
            });
          else {
            req.session[req.hostname].nsfwAccepted = user.nsfwAccepted;
            req.session[req.hostname].userInfo = user;
            req.session[req.hostname].theme = user.userSettings.theme;
            delete req.session[req.hostname].lockoutCooldown;
            req.session[req.hostname].loginAttempts = 0;
            let profileInfo = false;
            let emissions = false;

            // User is logging in from a login modal on a profile page
            if (req.body.emissions && req.body.profile) {
              profileInfo = await a.getEmissionsFromProfile(
                req.body.profile,
                req
              );
              profileInfo.loaded = true;
            } else if (req.body.emissions) {
              emissions = await c.getEmissions(
                { emissionID: { $in: req.body.emissions } },
                999999,
                req.session[req.hostname].userInfo
              );
              req.session[req.hostname].emissionsCollected =
                h.getUniqueEmissions(emissions);
            }
            res.status(200).json({
              userInfo: {
                ...h.returnClientUserInfo({
                  ...user,
                  nsfwAccepted: user.nsfwAccepted,
                }),
              },
              profileInfo: profileInfo,
              emissions: emissions,
            });
          }
        }
      }
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Fired when the user submits a request to reset their password
 *
 * Validate the inputs
 * Find user with username/email combination
 * Limit to 3 successful requests per hour
 * Invalidate all other reset requests
 * Email new reset request
 * Insert new reset request
 *
 * Request Body
 * {
 * username: String - The user's username
 * email: String - The user's email address
 * captchaKey: String - The user's Captcha key
 * }
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    forgot_password_schema.validateSync(req.body);
    const user = await db.collection("users").findOne({
      username: new RegExp(`^${req.body.username}$`, "i"),
      email: new RegExp(`^${req.body.email}$`, "i"),
    });
    if (!user) res.sendStatus(404);
    else {
      const captchaCheck = await h.verifyCaptcha(req.body.captchaKey);
      const check = await db.collection("passwordResets").countDocuments({
        timestamp: {
          $gt: new Date(new Date().setHours(new Date().getHours() - 1)),
        },
        userID: user._id,
      });
      if (check >= 3)
        res.status(200).json({
          error:
            "You are sending too many requests. Please wait a while and try again later.",
        });
      else if (!(user && captchaCheck))
        res.status(200).json({
          error: "Email/username combination not found",
        });
      else {
        const resetID = uuid();
        axios
          .post(process.env.EMAIL_SERVER + "/emails/password-reset", {
            emailKey: process.env.EMAIL_KEY,
            appName: process.env.APP_NAME,
            email: req.body.email,
            username: req.body.username,
            resetID: resetID,
            root: process.env.ROOT,
            instanceID: process.env.INSTANCE_ID,
          })
          .then(async () => {
            const id = crypto.randomBytes(8).toString("hex");
            await db
              .collection("passwordResets")
              .updateMany({ userID: user._id }, { $set: { valid: false } });
            await db.collection("passwordResets").insertOne({
              _id: id,
              timestamp: new Date(),
              uuid: resetID,
              userID: user._id,
              valid: true,
              email: user.email,
            });
            res.status(200).json({
              success: true,
            });
          })
          .catch((err) => {
            console.log("email server error", err);
            res.status(200).json({
              error:
                "There was an error generating the reset email. Please try again later.",
            });
          });
      }
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Hits when the user lands on the password reset page
 *
 * Checks whether the request exists
 */
router.get("/reset-request/:uuid", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    const request = await db.collection("passwordResets").findOne({
      uuid: req.params.uuid,
      valid: true,
    });
    if (!request)
      res.status(200).json({
        notFound: true,
      });
    else if (
      new Date(request.timestamp) <
      new Date(new Date().setDate(new Date().getDate() - 1))
    )
      res.status(200).json({
        expired: true,
      });
    else res.status(200).json({});
  } catch (err) {
    res.sendStatus(500);
  }
});

/**
 * Hit when the user resets their password after clicking a link to do so in their email
 *
 * Validate the inputs
 * Looks for the password reset request
 * Updates the user
 * Invalidates the reset request
 *
 * Request Body
 * {
 * password1: String - The user's plaintext password
 * password2: Same as password1
 * uuid: String - ref db.collection('passwordResets').uuid
 * }
 */
router.post("/change-password", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    change_password_uuid_schema.validateSync(req.body);
    const request = await db.collection("passwordResets").findOne({
      uuid: String(req.body.uuid),
      valid: true,
      timestamp: {
        $gte: new Date(new Date().setDate(new Date().getDate() - 1)),
      },
    });
    if (!request)
      res.status(200).json({
        error: "Password reset request expired or does not exist",
      });
    else {
      const passHash = await bcrypt.hash(req.body.password1, 8);
      await db.collection("users").updateOne(
        {
          _id: request.userID,
        },
        {
          $set: {
            password: passHash,
          },
        }
      );
      await db.collection("passwordResets").updateOne(
        {
          _id: request._id,
        },
        {
          $set: {
            valid: false,
          },
        }
      );
      const newUserInfo = await db
        .collection("users")
        .findOne({ _id: request.userID });
      if (!req.session[req.hostname].nsfwAccepted)
        newUserInfo.nsfwAccepted = false;
      req.session[req.hostname].userInfo = newUserInfo;
      res.status(200).json(
        h.returnClientUserInfo({
          ...newUserInfo,
          nsfwAccepted: req.session[req.hostname].nsfwAccepted,
        })
      );
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

/**
 * Hit when the user cancels a password reset request that was emailed to them
 * Invalidates the request
 */
router.post("/cancel", async (req, res) => {
  try {
    const db = client.db(req.session[req.hostname].instanceID);
    await db.collection("passwordResets").updateOne(
      {
        uuid: req.body.uuid,
      },
      {
        $set: {
          valid: false,
        },
      }
    );
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

module.exports = router;

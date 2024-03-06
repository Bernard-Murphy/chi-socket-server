const express = require("express");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const cors = require("cors");
const ioServer = require("socket.io");
const { createAdapter } = require("@socket.io/mongo-adapter");
const { Emitter } = require("@socket.io/mongo-emitter");
const { MongoClient } = require("mongodb");
const http = require("http");
const { v4: uuid } = require("uuid");
const socketHandler = require("./sockets");
const fs = require("fs");
const crypto = require("crypto");
const renderMetadata = require("./utilities/renderMetadata");
const renderSite = require("./utilities/renderSite");
const routes = require("./utilities/routes");
const h = require("./utilities/helpers");
const { html2json } = require("html2json");

process.env.PUBLIC_KEY = fs.readFileSync(__dirname + "/publicKey.key");
process.env.PRIVATE_KEY = fs.readFileSync(__dirname + "/privateKey.key");

/**
 * Every user connects with an instance ID and session id
 * req.session pulled from instance session store
 */

let expiredTokens = [];

const mongoUrl =
  "mongodb+srv://" +
  process.env.MONGO_USER +
  ":" +
  encodeURIComponent(process.env.MONGO_PASSWORD) +
  "@" +
  process.env.MONGO_HOST +
  "/?retryWrites=true&w=majority";

process.env.PUBLIC_KEY = fs
  .readFileSync(__dirname + "/publicKey.key")
  .toString();
const port = process.env.PORT;

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);

// Set up cookies
const sessionStore = new MongoDBStore({
  uri:
    "mongodb+srv://" +
    process.env.MONGO_USER +
    ":" +
    encodeURIComponent(process.env.MONGO_PASSWORD) +
    "@" +
    process.env.MONGO_HOST +
    "/?retryWrites=true&w=majority",

  databaseName: process.env.DATABASE,
  collection: "sessions",
});
const sessionConfig = {
  name: process.env.APP_NAME,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 365,
    secure: false,
    httpOnly: false,
  },
  store: sessionStore,
  resave: true,
  saveUninitialized: false,
};
const sessionObj = session(sessionConfig);
app.use(sessionObj);

app.use(renderMetadata);
app.use(express.static(__dirname + "/public", { index: false }));

app.use(async (req, res, next) => {
  try {
    if (!req.url.includes(".") && !decodeURIComponent(req.url).includes("卐")) {
      const db = socketClient.db("sessionServer");
      const hostname = h.parseHost(req.hostname);
      console.log(hostname);
      if (!req.session[hostname]?.instanceID) {
        const instanceInfo = await db
          .collection("instances")
          .findOne({ domain: hostname });
        if (!instanceInfo) return res.sendStatus(404);
        req.session[hostname] = {
          instanceID: instanceInfo.instanceID,
        };
      }
      if (
        req.session[hostname].verificationEmail &&
        !req.session[hostname].verificationTimestamp
      )
        req.session[hostname].verificationTimestamp = new Date();
      if (!req.session.sessionID) req.session.sessionID = uuid();

      if (!req.session[hostname].theme) req.session[hostname].theme = "default";
      if (!req.session[hostname].nsfwAccepted)
        req.session[hostname].nsfwAccepted = false;
      if (!req.session[hostname].notifications)
        req.session[hostname].notifications = [];
      if (!req.session[hostname].unreadMessages)
        req.session[hostname].unreadMessages = [];
      if (!req.session[hostname].emissionsCollected)
        req.session[hostname].emissionsCollected = [];
      if (!req.session[hostname].userInfo && !req.session[hostname].tempID)
        req.session[hostname].tempID = crypto.randomBytes(8).toString("hex");
    }
    next();
  } catch (err) {
    console.log("Entry error", err);
    res.sendStatus(500);
  }
});

const io = ioServer(server, {
  cors: true,
});
// Wrap socket with express-session object so that socket can access user session info
const wrapSocketMiddleware = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);
io.use(wrapSocketMiddleware(sessionObj)); // Session object can be accessed by websockets

const socketClient = new MongoClient(mongoUrl);

(async () => {
  await socketClient.connect();
  const socketCollection = socketClient
    .db("sessionServer")
    .collection("sockets");
  io.adapter(createAdapter(socketCollection));
  const emitter = new Emitter(socketCollection);

  const expireTokens = async () => {
    try {
      const tokensToExpire = expiredTokens.filter(
        (token) =>
          new Date() >
          new Date(token.timestamp).setSeconds(
            new Date(token.timestamp).getSeconds() + 15
          )
      );
      if (tokensToExpire.length) {
        await socketClient
          .db("sessionServer")
          .collection("sessions")
          .bulkWrite(
            tokensToExpire.map((token) => ({
              updateOne: {
                filter: {
                  "session.sessionID": token.sessionID,
                },
                update: {
                  $push: {
                    [`session.${token.host}.expiredTokens`]: token.token,
                  },
                },
              },
            }))
          );
        expiredTokens = expiredTokens.filter(
          (token) => !tokensToExpire.find((t) => t.token === token.token)
        );
      }

      setTimeout(expireTokens, 5000);
    } catch (err) {
      console.log("expireTokens error", err);
    }
  };

  expireTokens();

  app.get("/no-token", (req, res) => {
    try {
      const hostname = h.parseHost(req.hostname);
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

      if (req.session[hostname].verificationEmail) {
        metadata.verificationDetails = {
          timestamp: req.session[hostname].verificationTimestamp,
          email: req.session[hostname].verificationEmail,
        };
      }

      res.status(200).json({
        metadata: metadata,
      });
    } catch (err) {
      console.log("/no-token error", err);
      res.sendStatus(200);
    }
  });

  io.on("connection", (socket) => socketHandler(io, socket));

  app.post("/socket-emit", (req, res) => {
    try {
      console.log("socket emit", req.body);
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);

      emitter
        .to(req.body.to + "卐卐卐卐" + req.body.instanceID)
        .emit(...req.body.emit);
      res.sendStatus(200);
    } catch (err) {
      console.log("Socket emit error", err);
      res.sendStatus(500);
    }
  });

  app.post("/socket-bulk", (req, res) => {
    try {
      console.log("socket bulk", req.body);
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);

      req.body.recipients.forEach((recipient) => {
        try {
          emitter
            .to(req.body.to + "卐卐卐卐" + req.body.instanceID)
            .emit(...req.body.emit);
        } catch (err) {
          console.log("Error emitting to recipient", err);
          console.log(recipient);
        }
      });
      res.sendStatus(200);
    } catch (err) {
      console.log("Socket bulk error", err);
      res.sendStatus(500);
    }
  });

  app.post("/socket-notify", (req, res) => {
    try {
      console.log("socket notify", req.body);
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);

      req.body.notifications.forEach((notification) => {
        try {
          emitter
            .to(notification.userID + "卐卐卐卐" + req.body.instanceID)
            .emit("notification", notification);
        } catch (err) {
          console.log("Error emitting to recipient", err);
          console.log(recipient);
        }
      });
    } catch (err) {
      console.log("/socket-notify error", err);
      res.sendStatus(500);
    }
  });

  app.post("/expire-token", (req, res) => {
    try {
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);
      expiredTokens.push({
        timestamp: new Date(),
        sessionID: req.body.sessionID,
        token: req.body.token,
        host: req.body.host,
      });
      res.sendStatus(200);
    } catch (err) {
      console.log("/expire-token error", err);
      res.sendStatus(500);
    }
  });

  app.use("/", routes(io, emitter));

  app.get("*", async (req, res) => {
    try {
      if (req.url.includes(".") || decodeURIComponent(req.url).includes("卐"))
        return res.sendStatus(404);
      renderSite(req, res);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  app.all("*", (req, res) => {
    console.log("not found", req.url);
    res.sendStatus(404);
  });

  server.listen(port, () =>
    console.log("Chi socket server running on port", port)
  );
})();

const express = require("express");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const cors = require("cors");
const ioServer = require("socket.io");
const { createAdapter } = require("@socket.io/mongo-adapter");
const { MongoClient } = require("mongodb");
const http = require("http");
const { v4: uuid } = require("uuid");
const socketHandler = require("./sockets");
const fs = require("fs");
const crypto = require("crypto");
const renderMetadata = require("./utilities/renderMetadata");
const renderSite = require("./utilities/renderSite");
const { client } = require("./db");

/**
 * Every user connects with an instance ID and session id
 * req.session pulled from instance session store
 */

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

const io = ioServer(server, {
  cors: true,
});

const socketClient = new MongoClient(mongoUrl);

(async () => {
  await socketClient.connect();
  io.adapter(
    createAdapter(socketClient.db("sessionServer").collection("sockets"))
  );

  app.use(async (req, res, next) => {
    const db = socketClient.db("sessionServer");
    try {
      if (!req.session[req.hostname]?.instanceID) {
        const instanceInfo = await db
          .collection("instances")
          .findOne({ domain: req.hostname });
        if (!instanceInfo) return res.sendStatus(404);
        req.session[req.hostname].instanceID = instanceInfo.instanceID;
      }
      if (!req.session.sessionID) req.session.sessionID = uuid();
      if (!req.session[req.hostname].theme)
        req.session[req.hostname].theme = "default";
      if (!req.session[req.hostname].nsfwAccepted)
        req.session[req.hostname].nsfwAccepted = false;
      if (!req.session[req.hostname].notifications)
        req.session[req.hostname].notifications = [];
      if (!req.session[req.hostname].unreadMessages)
        req.session[req.hostname].unreadMessages = [];
      if (!req.session[req.hostname].emissionsCollected)
        req.session[req.hostname].emissionsCollected = [];
      if (
        !req.session[req.hostname].userInfo &&
        !req.session[req.hostname].tempID
      )
        req.session[req.hostname].tempID = crypto
          .randomBytes(8)
          .toString("hex");

      next();
    } catch (err) {
      console.log("Entry error", err);
      res.sendStatus(500);
    }
  });

  // Wrap socket with express-session object so that socket can access user session info
  const wrapSocketMiddleware = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);
  io.use(wrapSocketMiddleware(sessionObj)); // Session object can be accessed by websockets
  io.on("connection", (socket) => socketHandler(io, socket));

  app.post("/socket-emit", (req, res) => {
    try {
      if (req.body.socketKey === process.env.SOCKET_KEY)
        io.to(req.body.to + "卐卐卐卐" + req.body.instanceID).emit(
          ...req.body.emit
        );
      res.sendStatus(200);
    } catch (err) {
      console.log("Socket emit error", err);
      res.sendStatus(500);
    }
  });

  app.post("/socket-bulk", (req, res) => {
    try {
      req.body.recipients.forEach((recipient) => {
        try {
          io.to(req.body.to + "卐卐卐卐" + req.body.instanceID).emit(
            ...req.body.emit
          );
        } catch (err) {
          console.log("Error emitting to recipient", err);
          console.log(recipient);
        }
      });
    } catch (err) {
      console.log("Socket bulk error", err);
      res.sendStatus(500);
    }
  });

  app.use(renderMetadata);
  app.use(express.static(__dirname + "/public", { index: false }));

  app.get("*", async (req, res) => {
    try {
      if (req.url.split(".").length > 1) return res.sendStatus(404);
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

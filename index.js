const express = require("express");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const cors = require("cors");
const ioServer = require("socket.io");
const http = require("http");
const { v4: uuid } = require("uuid");
const socketHandler = require("./sockets");
const fs = require("fs");
const crypto = require("crypto");
const renderMetadata = require("./utilities/renderMetadata");
const renderSite = require("./utilities/renderSite");

/**
 * Every user connects with an instance ID and session id
 * req.session pulled from instance session store
 */

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
app.use((req, res, next) => {
  if (!req.session.sessionID) req.session.sessionID = uuid();
  if (!req.session?.theme) req.session.theme = "default";
  if (!req.session.nsfwAccepted) req.session.nsfwAccepted = false;
  if (!req.session.notifications) req.session.notifications = [];
  if (!req.session.unreadMessages) req.session.unreadMessages = [];
  if (!req.session.emissionsCollected) req.session.emissionsCollected = [];
  if (!req.session.userInfo && !req.session.tempID)
    req.session.tempID = crypto.randomBytes(8).toString("hex");

  next();
});

// Wrap socket with express-session object so that socket can access user session info
const wrapSocketMiddleware = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);
io.use(wrapSocketMiddleware(sessionObj)); // Session object can be accessed by websockets
io.on("connection", (socket) => socketHandler(io, socket));

app.post("/socket-emit", (req, res) => {
  if (req.body.socketKey === process.env.SOCKET_KEY)
    io.to(req.body.to + "卐卐卐卐" + req.body.instanceID).emit(
      ...req.body.emit
    );
  res.sendStatus(200);
});

app.use(express.static(__dirname + "/public", { index: false }));

app.get("/", renderSite);

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

const express = require("express");
const cors = require("cors");
const ioServer = require("socket.io");
const http = require("http");
const socketHandler = require("./sockets");
/**
 * Every user connects with an instance ID and session id
 * req.session pulled from instance session store
 */

const port = process.env.PORT;

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = ioServer(server, {
  cors: true,
});
io.use(async (socket, next) => {
  try {
    console.log(socket.request.headers.authorization);
    next();
  } catch (err) {
    console.log("Error obtaining user session", err);
  }
});
io.on("connection", (socket) => socketHandler(io, socket));

app.post("/", (req, res) => {
  if (req.body.socketKey === process.env.SOCKET_KEY)
    io.to(req.body.to).emit(...req.body.emit);
});

server.listen(port, () =>
  console.log("Chi socket server running on port", port)
);

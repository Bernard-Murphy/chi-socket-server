/**
 * This is the socket handler root
 * Exports all of the socket handlers at once so that only one object needs to be imported in the main server file
 * Socket handler is wrapped with express-session
 */

const crypto = require("crypto");
const messages = require("./messages");
const users = require("./users");
const h = require("../utilities/helpers");
const { MongoClient } = require("mongodb");

const mongoUrl =
  "mongodb+srv://" +
  process.env.MONGO_USER +
  ":" +
  encodeURIComponent(process.env.MONGO_PASSWORD) +
  "@" +
  process.env.MONGO_HOST +
  "/?retryWrites=true&w=majority";
const client = new MongoClient(mongoUrl);

const socketHandler = async (io, socket) => {
  try {
    /**
     * If logged in, join user room
     * If not logged in, join tempID room
     * If on feed, join "f"
     * if on profile page, join profile room (username卐)
     * If on tag page, join tag room (tag卐卐)
     */
    if (socket.handshake.query?.socketKey === process.env.SOCKET_KEY) {
      const peerID = socket.handshake.query.peerID;
      const sessionDB = client.db("sessionServer");
      await sessionDB.collection("streamClients").insertOne({
        _id: crypto.randomBytes(8).toString("hex"),
        peerID,
        status: "available", // 'available' | 'occupied'
        hostID: false,
        clients: [],
      });
      socket.join(socket.handshake.query.peerID);

      socket.on("disconnecting", async () => {
        try {
          await sessionDB.collection("streamClients").deleteMany({
            peerID,
          });
        } catch (err) {
          console.log("Stream child disconnect error", err);
        }
      });
    } else {
      if (!socket.request?.session) {
        console.log("no session found");
        return;
      }
      let host =
        socket.request.headers.Referer || socket.request.headers.referer;
      host = h.parseHost(host);
      if (!host) {
        console.log("No host", socket.request.headers);
        return;
      }
      const suffix = "卐卐卐卐" + socket.request.session[host].instanceID;

      console.log("join", socket.handshake.query.join + suffix);
      console.log(
        "join",
        (socket.request.session[host].userInfo?._id ||
          socket.request.session[host].tempID) + suffix
      );
      socket.join(socket.handshake.query.join + suffix);
      socket.join(
        (socket.request.session[host].userInfo?._id ||
          socket.request.session[host].tempID) + suffix
      );

      socket.on("update-state", (state) => {
        socket.leave(state.previous.join + suffix);
        socket.join(state.current.join + suffix);
        socket.join(
          (socket.request.session[host].userInfo?._id ||
            socket.request.session[host].tempID) + suffix
        );
      });
      messages(io, socket, host, suffix);
      users(io, socket, host, suffix);
    }
  } catch (err) {
    console.log("Socket handler error", err);
  }
};

module.exports = socketHandler;

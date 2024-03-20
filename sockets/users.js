const c = require("../utilities/longCalls");
const h = require("../utilities/helpers");
const { io: streamIO } = require("socket.io-client");
const { live_title_schema } = require("../utilities/validations");
const { MongoClient } = require("mongodb");
const { v4: uuid } = require("uuid");

const mongoUrl =
  "mongodb+srv://" +
  process.env.MONGO_USER +
  ":" +
  encodeURIComponent(process.env.MONGO_PASSWORD) +
  "@" +
  process.env.MONGO_HOST +
  "/?retryWrites=true&w=majority";
const client = new MongoClient(mongoUrl);

const userSocket = async (io, socket, host, suffix) => {
  try {
    const streamViewID = uuid();
    const userID = socket.request.session[host].userInfo?._id;
    const username =
      socket.request.session[host].userInfo?.username.toLowerCase() + "卐";
    const instanceID = socket.request.session[host].instanceID;
    const room = socket.handshake.query.join;
    let streamSocket;
    let lastMessage = new Date();

    const login = async () => {
      try {
        if (userID) {
          const db = client.db(instanceID);
          const Conversations = db.collection("conversations");
          const ModLogs = db.collection("modLogs");
          const Notifications = db.collection("notifications");
          const Reports = db.collection("reports");
          const conversations = await Conversations.find({
            parties: userID,
            "messages.read": false,
          }).toArray();
          const unreadMessages = conversations.reduce(
            (prev, curr) =>
              prev +
              curr.messages.filter((m) => m.author !== userID && !m.read)
                .length,
            0
          );
          socket.emit("message-count", unreadMessages);

          const notifications = await Notifications.countDocuments({
            userID: userID,
            unread: true,
          });
          socket.emit("notification-count", notifications);

          if (h.checkJanny_userInfo(socket.request.session[host].userInfo)) {
            const reports = await Reports.find({
              dismissed: false,
            }).toArray();
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
            socket.emit("report-count", open.length);
          }
          if (h.checkChadmin_userInfo(socket.request.session[host].userInfo)) {
            const unreadModLogs = await ModLogs.countDocuments({
              readBy: { $ne: userID },
            });
            socket.emit("unread-modlog-count", unreadModLogs);
          }
        }
      } catch (err) {
        console.log("socket error", err);
      }
    };

    login();

    /**
     * Hit when the user sends a message to the chat of their own live stream
     * Emits the message (does not save)
     */
    socket.on("send-stream-chat-self", (message) => {
      try {
        if (
          new Date() >
          new Date(
            new Date(lastMessage).setSeconds(
              new Date(lastMessage).getSeconds() + 2
            )
          )
        ) {
          lastMessage = new Date();
          if (message.message.length < 501) {
            io.to(username + suffix).emit("stream-chat", {
              ...message,
              user: username.split("卐")[0],
              timestamp: new Date(),
            });
            io.to(userID + suffix).emit("stream-chat-self", {
              ...message,
              user: username.split("卐")[0],
              timestamp: new Date(),
            });
          }
        }
      } catch (err) {
        console.log("sent stream chat self error", err);
      }
    });

    /**
     * Hit when the user sends a message to the chat of another user's live stream
     * Emits the message (does not save)
     */
    socket.on("send-stream-chat-other", (message) => {
      try {
        if (
          userID &&
          new Date() >
            new Date(
              new Date(lastMessage).setSeconds(
                new Date(lastMessage).getSeconds() + 2
              )
            )
        ) {
          lastMessage = new Date();
          if (message.message.length < 501) {
            io.to(username + suffix).emit("stream-chat", {
              ...message,
              user: username.split("卐")[0],
              timestamp: new Date(),
            });
            io.to(userID + suffix).emit("stream-chat-self", {
              ...message,
              user: username.split("卐")[0],
              timestamp: new Date(),
            });
          }
        }
      } catch (err) {
        console.log("send stream chat other error", err);
      }
    });

    /**
     * Hits when the user starts a stream
     *
     * Verify that the user is allowed to stream
     * Validate the stream title
     * Make Socket.io connection to live stream server
     */
    socket.on("start-stream", async (details) => {
      try {
        const sessionDB = client.db("sessionServer");
        const db = client.db(instanceID);
        const Users = db.collection("users");
        const instanceInfo = await sessionDB
          .collection("instances")
          .findOne({ instanceID: instanceID });
        if (!instanceInfo) throw "Instance not found";
        if (
          instanceInfo.preferences.streaming_enabled &&
          userID &&
          (!instanceInfo.preferences.streaming_verification_required ||
            h.checkJanny_userInfo(socket.request.session[host].userInfo) ||
            socket.request.session[host].userInfo.verified)
        ) {
          try {
            live_title_schema.validateSync(
              {
                streamTitle: details.streamTitle,
              },
              {
                abortEarly: false,
              }
            );
          } catch (err) {
            details.streamTitle = "Live Stream";
          }
          if (!details.streamTitle) details.streamTitle = "Live Stream";
          streamSocket = streamIO(process.env.STREAM_SERVER, {
            query: {
              key: process.env.STREAM_KEY,
              peerID: details.peerID,
              userID: userID,
              instanceID: instanceID,
              avatar: JSON.stringify(
                socket.request.session[host].userInfo.avatar
              ),
              username: socket.request.session[host].userInfo.username,
              headers: JSON.stringify(socket.request.headers),
              streamTitle: details.streamTitle,
              root: "https://" + host,
              database: instanceID,
              clipCount: details.clipCount,
            },
          });
          streamSocket.on("viewers", async (viewers) => {
            try {
              const update = await Users.findOneAndUpdate(
                {
                  _id: userID,
                  live: {
                    $ne: false,
                  },
                },
                {
                  $set: {
                    "live.viewers": Number(viewers),
                  },
                },
                {
                  returnDocument: "after",
                }
              );
              if (update.value) {
                io.to(username + suffix).emit(
                  "viewers",
                  update.value.live.viewers
                );
                io.to(userID + suffix).emit(
                  "viewers-self",
                  update.value.live.viewers
                );
              }
            } catch (err) {
              console.log("set viewers error", err);
            }
          });

          streamSocket.on("new-live", async (emissionData) => {
            try {
              const db = client.db(emissionData.instanceID);
              const sessionDB = client.db("sessionServer");
              const userInfo = await db
                .collection("users")
                .findOne({ _id: emissionData.userID });
              const context = {
                session: {
                  userInfo: userInfo,
                },
                mongoClient: client,
                instanceInfo: {
                  instanceID: emissionData.instanceID,
                },
              };
              let emission = await c.getEmission(
                { emissionID: emissionData.emissionID },
                context
              );
              await sessionDB.collection("sessions").updateMany(
                {
                  [`session.${host}.profile`]: userInfo._id,
                },
                {
                  $push: {
                    [`session.${host}.emissionsCollected`]: emission.emissionID,
                  },
                }
              );
              const viewers = io.sockets.adapter.rooms.get(
                userInfo.username.toLowerCase()
              );
              if (viewers && viewers.size) {
                await db.collection("emissions").updateOne(
                  {
                    emissionID: emission.emissionID,
                  },
                  {
                    $inc: {
                      views: viewers.size,
                    },
                  }
                );
              }

              io.to(userInfo.username.toLowerCase()).emit(
                "new-emission",
                emission
              );
            } catch (err) {
              console.log("New Live error", err);
            }
          });
        }
      } catch (err) {
        console.log("start stream error", err);
      }
    });

    socket.on("view-stream", async (hostID, peerID) => {
      try {
        const sessionDB = client.db("sessionServer");
        const db = client.db(instanceID);

        const existing = await sessionDB
          .collection("streamClients")
          .findOneAndUpdate(
            {
              clients: {
                size: {
                  $lt: 10,
                },
              },
              userID: hostID,
            },
            {
              $push: {
                clients: {
                  timestamp: new Date(),
                  userID,
                  peerID,
                },
              },
            },
            {
              returnDocument: "after",
            }
          );
        if (existing) {
          io.to(existing.peerID).emit("add-client", peerID);
        } else {
          const userInfo = await db
            .collection("users")
            .findOne({ _id: hostID });
          if (!userInfo.live) return;

          const newHost = await sessionDB
            .collection("streamClients")
            .findOneAndUpdate(
              {
                userID: null,
              },
              {
                $set: {
                  userID: hostID,
                },
                $push: {
                  clients: {
                    timestamp: new Date(),
                    userID,
                    peerID,
                  },
                },
              },
              {
                returnDocument: "after",
              }
            );
          if (newHost) {
            io.to(newHost.peerID).emit("init", userInfo.live.id, peerID);
          } else {
            console.log("No clients available");
          }
        }
      } catch (err) {
        console.log("view stream error", err);
      }
    });

    /**
     * Hit when the user manually ends the stream
     *
     * Disconnect the stream socket
     * Emits stream-end event to all the viewers
     */
    socket.on("end-stream", async () => {
      try {
        if (streamSocket?.disconnect) streamSocket.disconnect();
        streamSocket = false;
        const db = client.db(instanceID);
        await db.collection("users").updateOne(
          {
            _id: userID,
          },
          {
            $set: {
              live: false,
            },
          }
        );
        io.to(username + suffix).emit("stream-end");
        io.to(userID + suffix).emit("stream-terminated");
      } catch (err) {
        console.log(err);
      }
    });

    /**
     * Hit when the user disconnects
     * Sets the user's live status to false
     * If the user was watching a stream, decrement the view count by one and emit new view count to other viewers and streamer
     * If the user was streaming, disconnect the stream socket
     */

    socket.on("disconnecting", async () => {
      try {
        if (socket.request.session[host].userInfo && streamSocket) {
          if (streamSocket.disconnect) streamSocket.disconnect();
          streamSocket = false;
          const db = client.db(instanceID);
          const sessionDB = client.db("sessionServer");
          await db.collection("users").updateOne(
            {
              _id: userID,
            },
            {
              $set: {
                live: false,
              },
            }
          );
          await sessionDB.collection("streamClients").updateMany(
            {
              "clients.id": streamViewID,
            },
            {
              $pull: {
                clients: {
                  id: streamViewID,
                },
              },
            }
          );
          io.to(username + suffix).emit("stream-end");
          io.to(userID + suffix).emit("stream-terminated");
        }
      } catch (err) {
        console.log("disconnected error", err);
      }
    });
  } catch (err) {
    console.log("socket error", err);
  }
};

module.exports = userSocket;

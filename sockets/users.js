const {
  endStream,
  getOpenReports,
  setStreamViewers,
  getUnreadMessagesNotifications,
  getUnreadModLogs,
} = require("../db");
const h = require("../utilities/helpers");
const { io: streamIO } = require("socket.io-client");
const { live_title_schema } = require("../utilities/validations");

const userSocket = async (io, socket, host, suffix) => {
  try {
    const userID = socket.request.session[host].userInfo?._id;
    const username = socket.request.session[host].userInfo?.username + "卐";
    const instanceID = socket.request.session[host].instanceID;
    const room = socket.handshake.query.join;
    let streamSocket;
    let lastMessage = new Date();

    const login = async () => {
      try {
        if (userID) {
          socket.emit("initialized");
          const unreadMessagesNotifications =
            await getUnreadMessagesNotifications({
              instanceID,
              userID,
            });

          const { unreadMessages, notifications } = unreadMessagesNotifications;
          socket.emit("message-count", unreadMessages);
          socket.emit("notification-count", notifications);

          if (h.checkJanny(socket.request)) {
            const openReports = await getOpenReports({ instanceID });
            socket.emit("report-count", openReports);
          }
          if (h.checkChadmin(socket.request)) {
            const unreadModLogs = await getUnreadModLogs({
              instanceID,
              userID,
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
              user: room.split("卐")[0],
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
            io.to(room.split("卐")[0] + suffix).emit("stream-chat", {
              ...message,
              user: room.split("卐")[0],
              timestamp: new Date(),
            });
            io.to(room + suffix).emit("stream-chat-self", {
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
        if (
          process.env.STREAMING_ENABLED === "true" &&
          userID &&
          (process.env.STREAMING_VERIFICATION_REQUIRED !== "true" ||
            h.checkJanny(socket.request) ||
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
              instanceID: process.env.INSTANCE_ID,
              avatar: JSON.stringify(
                socket.request.session[host].userInfo.avatar
              ),
              username:
                socket.request.session[host].userInfo.username.split("卐")[0],
              headers: JSON.stringify(socket.request.headers),
              streamTitle: details.streamTitle,
              root: process.env.ROOT,
              database: process.env.DATABASE,
              clipCount: details.clipCount,
            },
          });
          streamSocket.on("viewers", async (viewers) => {
            try {
              const update = await setStreamViewers({
                instanceID,
                userID,
                viewers,
              });
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
        }
      } catch (err) {
        console.log("start stream error", err);
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
        if (streamSocket && streamSocket.disconnect) streamSocket.disconnect();
        streamSocket = false;
        await endStream({
          instanceID,
          userID,
        });
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
          await endStream({
            instanceID,
            userID,
          });
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

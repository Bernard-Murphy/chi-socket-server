const h = require("../utilities/helpers");
const { newMessage, setMessageRead } = require("../db");
const maxChars = 5000;

const messageSocket = () => async (io, socket, host, suffix) => {
  try {
    let lastMessage = new Date();
    /**
     * Hit when the user reads their private messages
     * Marks the message as read
     */
    socket.on("read-messages", async (userID) => {
      try {
        const conversations = await setMessageRead({
          instanceID: socket.request.session.instanceID,
          ownUserID: socket.request.session.userInfo._id,
          otherUserID: userID,
        });
        socket.emit(
          "message-count",
          conversations.reduce(
            (prev, curr) =>
              prev +
              curr.messages.filter(
                (m) =>
                  m.author !== socket.request.session.userInfo._id && !m.read
              ).length,
            0
          )
        );
      } catch (err) {
        console.log("read messages socket error", err);
      }
    });

    /**
     * Hit when the user sends a private message
     * Messages can be sent once every 3 seconds
     * Updates the conversation and transmits the message to the other party
     */
    socket.on("message", async (message) => {
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
          if (
            socket.request.session[host] &&
            socket.request.session[host].userInfo &&
            !socket.request.session[host].userInfo.ban.banned
          ) {
            message.message = h.sanitizeHTML(message.message);
            if (h.checkHTMLLength(message.message) <= maxChars) {
              await newMessage({
                message: message,
                session: request.session[host],
                instanceID: request.session[host].instanceID,
              });
              io.to(socket.request.session[host].userInfo.userID + suffix)
                .to(message.to.userID + suffix)
                .emit("new-message", {
                  message: message.message,
                  timestamp: new Date(),
                  author: socket.request.session[host].userInfo._id,
                  party: socket.request.session[host].userInfo._id,
                  id: message.id,
                });
            }
          }
        }
      } catch (err) {
        console.log("socket error", err);
      }
    });
  } catch (err) {
    console.log("socket error", err);
  }
};

module.exports = messageSocket;

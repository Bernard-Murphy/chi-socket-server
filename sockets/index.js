/**
 * This is the socket handler root
 * Exports all of the socket handlers at once so that only one object needs to be imported in the main server file
 * Socket handler is wrapped with express-session
 */

const messages = require("./messages");
const users = require("./users");

const socketHandler = (io, socket) => {
  /**
   * If logged in, join user room
   * If not logged in, join tempID room
   * If on feed, join "f"
   * if on profile page, join profile room (username卐)
   * If on tag page, join tag room (tag卐卐)
   */
  if (!socket.handshake.query?.request?.session) {
    console.log("no session found");
    return;
  }
  console.log("New connection");

  socket.join(socket.handshake.query.join);
  socket.join(
    socket.handshake.query.request.session.userInfo?._id ||
      socket.handshake.query.request.session.tempID
  );
  socket.join(
    socket.handshake.query.request.session.userInfo?._id ||
      socket.handshake.query.request.session.tempID
  );
  socket.on("update-state", (state) => {
    socket.leave(state.previous.join);
    socket.join(state.current.join);
    socket.join(
      socket.handshake.query.request.session.userInfo?._id ||
        socket.handshake.query.request.session.tempID
    );
  });
  messages(io, socket);
  users(io, socket);
};

module.exports = socketHandler;

/**
 * This is the socket handler root
 * Exports all of the socket handlers at once so that only one object needs to be imported in the main server file
 * Socket handler is wrapped with express-session
 */

const messages = require("./messages");
const users = require("./users");
const h = require("../utilities/helpers");

const socketHandler = (io, socket) => {
  /**
   * If logged in, join user room
   * If not logged in, join tempID room
   * If on feed, join "f"
   * if on profile page, join profile room (username卐)
   * If on tag page, join tag room (tag卐卐)
   */
  if (!socket.request?.session) {
    console.log("no session found");
    return;
  }
  let host = socket.request.headers.Referer || socket.request.headers.referer;
  if (!host) {
    console.log("No host", socket.request.headers);
    return;
  }
  host = h.parseHost(host);
  const suffix = "卐卐卐卐" + socket.request.session[host].instanceID;

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
};

module.exports = socketHandler;

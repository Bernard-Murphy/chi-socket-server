const h = require("./helpers");

const c = {};

/**
 *
 * @param {Socket} io - Socket.io socket object
 * @param {Object} emission - Emissions document
 * @returns Array of User _ids that voted in the emission's poll
 */
c.getPollData = async (io, emission, db) => {
  const Polls = db.collection("polls");
  const Users = db.collection("users");
  const pollData = await Polls.findOne({ _id: emission.pollID });
  if (!pollData) return false;
  pollData.voters = pollData.voters.filter((voter, v) => {
    if (v < 100) return true;
    return Object.keys(io.engine.clients).find((key) => {
      if (
        !io.engine.clients[key]?.request?.session ||
        !io.engine.clients[key].request.session.userInfo
      )
        return false;
      return (
        io.engine.clients[key].request.session.userInfo._id === voter.userID
      );
    });
  });
  const userIDs = [];
  pollData.voters.forEach((voter) => userIDs.push(voter.userID));
  if (userIDs.length) {
    const users = await Users.find({ _id: { $in: userIDs } }).toArray();
    users.forEach((user) =>
      pollData.voters.forEach((voter, v) => {
        if (voter.userID === user._id)
          pollData.voters[v] = {
            ...pollData.voters[v],
            ...h.returnClientUserInfo(user, true),
          };
      })
    );
  }
  return pollData;
};

module.exports = c;

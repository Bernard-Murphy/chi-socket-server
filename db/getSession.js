const connect = require("./connect");

const getSession = ({ instanceID, sessionID }) =>
  new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
        const session = await db
          .collection("sessions")
          .findOne({ "session.sessionID": sessionID });
        if (!session) return reject("Session not found");
        resolve(session.session);
      } catch (err) {
        reject(err);
      }
    })
  );

module.exports = getSession;

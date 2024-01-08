const connect = require("./connect");

const getSession = (options) =>
  new Promise(async (resolve, reject) =>
    connect(options.instanceID, async (db) => {
      try {
        const session = await db
          .collection("sessions")
          .findOne({ _id: options.sessionID });
        if (!session) return reject("Session not found");
        resolve(session.session);
      } catch (err) {
        reject(err);
      }
    })
  );

module.exports = getSession;

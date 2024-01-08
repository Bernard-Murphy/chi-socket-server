const connect = require("./connect");

/**
 *
 * @param {Object} options
 * * otherUserID
 * * ownUserID
 * * instanceID
 *
 * @returns
 */

const getUnreadModLogs = (options) => {
  const { instanceID } = options;
  new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
        const unreadModLogs = await db.collection("modLogs").countDocuments({
          readBy: { $ne: userID },
        });
        resolve(unreadModLogs);
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = getUnreadModLogs;

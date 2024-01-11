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

const setStreamViewers = (options) => {
  const { instanceID, userID, viewers } = options;
  return new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
        const update = await db.collection("users").findOneAndUpdate(
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
        resolve(update);
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = setStreamViewers;

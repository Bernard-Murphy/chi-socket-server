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

const template = (options) => {
  const { instanceID, userID } = options;
  new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
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
        resolve();
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = template;

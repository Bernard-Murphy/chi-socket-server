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
  return new Promise(async (resolve, reject) => {
    try {
      const db = client.db(instanceID);
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
  });
};

module.exports = template;

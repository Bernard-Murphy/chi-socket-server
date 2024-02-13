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

const getInstanceInfo = (options) => {
  const { hostname } = options;
  return new Promise(async (resolve, reject) =>
    connect("sessionServer", async (db) => {
      try {
        const instanceInfo = await db
          .collection("instances")
          .findOne({ domain: hostname });
        resolve(instanceInfo);
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = getInstanceInfo;

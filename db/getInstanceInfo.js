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
  const { hostname, instanceID } = options;
  return new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
        const instanceInfo = await db
          .collection("instances")
          // .findOne({ domain: hostname });
          .findOne({ _id: "e133a531e75df8cc" });
        resolve(instanceInfo);
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = getInstanceInfo;

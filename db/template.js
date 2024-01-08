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
  const { instanceID } = options;
  new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
        resolve();
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = template;

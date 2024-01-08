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

const setMessageRead = (options) => {
  const { otherUserID, ownUserID, instanceID } = options;
  return new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
        await db.collection("conversations").updateOne(
          {
            $and: [
              {
                parties: otherUserID,
              },
              {
                parties: ownUserID,
              },
            ],
          },
          {
            $set: {
              "messages.$[message].read": true,
            },
          },
          {
            arrayFilters: [
              {
                "message.author": otherUserID,
              },
            ],
          }
        );
        const conversations = await db
          .collection("conversations")
          .find({
            parties: ownUserID,
            "messages.read": false,
          })
          .toArray();
        resolve(conversations);
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = setMessageRead;

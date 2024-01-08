const connect = require("./connect");
const crypto = require("crypto");

/**
 *
 * @param {Object} options
 * * otherUserID
 * * ownUserID
 * * instanceID
 *
 * @returns
 */

const newMessage = (options) => {
  const { session, message, instanceID } = options;
  return new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      const Conversations = db.collection("conversations");
      try {
        const conversation = await Conversations.findOne({
          $and: [
            {
              parties: message.to.userID,
            },
            {
              parties: session.userInfo._id,
            },
          ],
        });
        if (conversation)
          Conversations.updateOne(
            {
              _id: conversation._id,
            },
            {
              $push: {
                messages: {
                  timestamp: new Date(),
                  author: session.userInfo._id,
                  message: message.message,
                  read: false,
                  id: message.id,
                },
              },
            }
          );
        else {
          const id = crypto.randomBytes(8).toString("hex");
          Conversations.insertOne({
            _id: id,
            parties: [session.userInfo._id, message.to.userID],
            messages: [
              {
                timestamp: new Date(),
                author: session.userInfo._id,
                message: message.message,
                read: false,
                id: message.id,
              },
            ],
            removed: false,
          });
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = newMessage;

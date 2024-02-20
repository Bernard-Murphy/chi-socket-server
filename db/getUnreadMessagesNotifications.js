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

const getUnreadMessagesNotifications = (options) => {
  const { instanceID, userID } = options;
  return new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
        const conversations = await db
          .collection("conversations")
          .find({
            parties: userID,
            "messages.read": false,
          })
          .toArray();
        const unreadMessages = conversations.reduce(
          (prev, curr) =>
            prev +
            curr.messages.filter((m) => m.author !== userID && !m.read).length,
          0
        );
        const notifications = await db
          .collection("notifications")
          .countDocuments({
            userID: userID,
            unread: true,
          });
        resolve({ notifications, unreadMessages });
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = getUnreadMessagesNotifications;

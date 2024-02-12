const h = require("../utilities/helpers");
const { MongoClient } = require("mongodb");

const mongoUrl =
  "mongodb+srv://" +
  process.env.MONGO_USER +
  ":" +
  encodeURIComponent(process.env.MONGO_PASSWORD) +
  "@" +
  process.env.MONGO_HOST +
  "/?retryWrites=true&w=majority";
const client = new MongoClient(mongoUrl);
const maxChars = 5000;

const messageSocket = () => async (io, socket, host, suffix) => {
  try {
    let lastMessage = new Date();
    const userID = socket.request.session[host].userInfo?._id;
    const username = socket.request.session[host].userInfo?.username + "卐";
    const instanceID = socket.request.session[host].instanceID;
    /**
     * Hit when the user reads their private messages
     * Marks the message as read
     */
    socket.on("read-messages", async (userID) => {
      try {
        const db = client.db(instanceID);
        const Conversations = db.collection("conversations");
        await Conversations.updateOne(
          {
            $and: [
              {
                parties: userID,
              },
              {
                parties: userID,
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
                "message.author": userID,
              },
            ],
          }
        );
        const conversations = await Conversations.find({
          parties: userID,
          "messages.read": false,
        }).toArray();
        socket.emit(
          "message-count",
          conversations.reduce(
            (prev, curr) =>
              prev +
              curr.messages.filter(
                (m) => m.author !== [host].userInfo._id && !m.read
              ).length,
            0
          )
        );
      } catch (err) {
        console.log("read messages socket error", err);
      }
    });

    /**
     * Hit when the user sends a private message
     * Messages can be sent once every 3 seconds
     * Updates the conversation and transmits the message to the other party
     */
    socket.on("message", async (message) => {
      try {
        const db = client.db(instanceID);
        const Conversations = db.collection("conversations");
        if (
          new Date() >
          new Date(
            new Date(lastMessage).setSeconds(
              new Date(lastMessage).getSeconds() + 2
            )
          )
        ) {
          lastMessage = new Date();
          if (
            socket.request.session[host] &&
            socket.request.session[host].userInfo &&
            !socket.request.session[host].userInfo.ban.banned
          ) {
            message.message = h.sanitizeHTML(message.message);
            if (h.checkHTMLLength(message.message) <= maxChars) {
              const conversation = await Conversations.findOne({
                $and: [
                  {
                    parties: message.to.userID,
                  },
                  {
                    parties: userID,
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
                        author: userID,
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
                  parties: [userID, message.to.userID],
                  messages: [
                    {
                      timestamp: new Date(),
                      author: userID,
                      message: message.message,
                      read: false,
                      id: message.id,
                    },
                  ],
                  removed: false,
                });
              }
              io.to(userID + suffix)
                .to(username + suffix)
                .emit("new-message", {
                  message: message.message,
                  timestamp: new Date(),
                  author: userID,
                  party: userID,
                  id: message.id,
                });
            }
          }
        }
      } catch (err) {
        console.log("socket error", err);
      }
    });
  } catch (err) {
    console.log("socket error", err);
  }
};

module.exports = messageSocket;

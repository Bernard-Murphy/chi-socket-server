const endStream = require("./endStream");
const getInstanceInfo = require("./getInstanceInfo");
const getOpenReports = require("./getOpenReports");
const getSession = require("./getSession");
const getUnreadModLogs = require("./getUnreadModLogs");
const getUnreadMessagesNotifications = require("./getUnreadMessagesNotifications");
const newMessage = require("./newMessage");
const setMessageRead = require("./setMessageRead");
const setStreamViewers = require("./setStreamViewers");
const connect = require("./connect");
const { MongoClient } = require("mongodb");

const mongoUrl =
  process.env.MONGO_URL ||
  "mongodb+srv://" +
    process.env.MONGO_USER +
    ":" +
    encodeURIComponent(process.env.MONGO_PASSWORD) +
    "@" +
    process.env.MONGO_HOST +
    "/?retryWrites=true&w=majority";

const client = new MongoClient(mongoUrl);

module.exports = {
  client,
  connect,
  endStream,
  getInstanceInfo,
  getOpenReports,
  getSession,
  getUnreadModLogs,
  getUnreadMessagesNotifications,
  newMessage,
  setMessageRead,
  setStreamViewers,
};

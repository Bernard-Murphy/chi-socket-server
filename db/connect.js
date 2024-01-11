const mongo = require("mongodb").MongoClient;

const mongoUrl =
  "mongodb+srv://" +
  process.env.MONGO_USER +
  ":" +
  encodeURIComponent(process.env.MONGO_PASSWORD) +
  "@" +
  process.env.MONGO_HOST +
  "/?retryWrites=true&w=majority";

const connect = async (database, callback) =>
  new Promise(async (resolve, reject) => {
    try {
      const client = await mongo.connect(mongoUrl);
      const db = client.db(database);
      resolve(db);
    } catch (err) {
      reject(err);
    }
  })
    .then(callback)
    .catch(callback);

module.exports = connect;
const crypto = require("crypto");
const mongo = require("mongodb").MongoClient;

const mongoUrl =
  "mongodb+srv://" +
  process.env.MONGO_USER +
  ":" +
  encodeURIComponent(process.env.MONGO_PASSWORD) +
  "@" +
  process.env.MONGO_HOST +
  "/?retryWrites=true&w=majority";

(async () => {
  try {
    console.log("connected");
    const client = await mongo.connect(mongoUrl);
    const db = client.db("sessionServer");
    let instance = await db.collection("instances").findOne({});
    instance.domain = "localhost";
    instance.instanceID = "8a737bbd-c8b7-4da5-abfb-82a512743357";
    instance._id = crypto.randomBytes(8).toString("hex");
    const insert = await db.collection("instances").insertOne(instance);
    console.log(insert);
  } catch (err) {
    console.log("error", err);
  }
})();

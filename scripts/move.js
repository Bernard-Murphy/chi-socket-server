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
  const client = await mongo.connect(mongoUrl);

  const cvdb = client.db("carbonValley");
  const newdb = client.db("sessionServer");

  const instances = await cvdb.collection("instances").find({}).toArray();

  for (let i = 0; i < instances.length; i++)
    await newdb.collection("instances").insertOne(instances[i]);
})();

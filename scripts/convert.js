const { connect } = require("../db");
const crypto = require("crypto");

connect("carbonValley", async (db) => {
  try {
    console.log("connected");
    const users = await db
      .collection("users")
      .find({ "instances.0": { $exists: true } })
      .toArray();
    const server = await db.collection("servers").findOne();
    for (let u = 0; u < users.length; u++) {
      const user = users[u];
      const serverData = server.users.find((u) => u.userID === user._id);
      const oldInstanceData = user.instances[0];
      if (oldInstanceData.status === "live") {
        const instance = {
          _id: crypto.randomBytes(8).toString("hex"),
          instanceID: oldInstanceData.uuid,
          userID: user._id,
          service: oldInstanceData.id,
          status: oldInstanceData.status,
          version: oldInstanceData.version,
          actions: oldInstanceData.actions,
          requestInfo: oldInstanceData.requestInfo,
          domain: serverData.domain,
          preferences: oldInstanceData.preferences,
        };
        await db.collection("instances").insertOne(instance);
      }
    }
  } catch (err) {
    console.log("error", err);
  }
});

const routes = require("express").Router();
const { MongoClient } = require("mongodb");
const h = require("./helpers");
const c = require("./longCalls");

const mongoUrl =
  "mongodb+srv://" +
  process.env.MONGO_USER +
  ":" +
  encodeURIComponent(process.env.MONGO_PASSWORD) +
  "@" +
  process.env.MONGO_HOST +
  "/?retryWrites=true&w=majority";
const client = new MongoClient(mongoUrl);

const moduleExports = (io, emitter) => {
  routes.post("/new-live", async (req, res) => {
    try {
      if (req.body.streamKey !== process.env.STREAM_KEY)
        return res.sendStatus(500);
      const host = h.parseHost(req.hostname);
      const emissionData = req.body;
      const db = client.db(emissionData.instanceID);
      const sessionDB = client.db("sessionServer");
      const userInfo = await db
        .collection("users")
        .findOne({ _id: emissionData.userID });
      const context = {
        session: {
          userInfo: userInfo,
        },
        mongoClient: client,
        instanceInfo: {
          instanceID: emissionData.instanceID,
        },
      };
      let emission = await c.getEmission(
        { emissionID: emissionData.emissionID },
        context
      );
      await sessionDB.collection("sessions").updateMany(
        {
          [`session.${host}.profile`]: userInfo._id,
        },
        {
          $push: {
            [`session.${host}.emissionsCollected`]: emission.emissionID,
          },
        }
      );
      const viewers = io.sockets.adapter.rooms.get(
        userInfo.username.toLowerCase()
      );
      if (viewers && viewers.size) {
        emission.views = viewers.size;
        await db.collection("emissions").updateOne(
          {
            emissionID: emission.emissionID,
          },
          {
            $inc: {
              views: viewers.size,
            },
          }
        );
      }
      const username = userInfo.username.toLowerCase() + "卐";
      const suffix = "卐卐卐卐" + context.instanceInfo.instanceID;
      console.log(username + suffix);
      io.to(username + suffix).emit("new-emission", emission);
      res.sendStatus(200);
    } catch (err) {
      console.log("new live error", err);
      res.sendStatus(500);
    }
  });

  routes.post("/increment-viewers", async (req, res) => {
    try {
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);

      const suffix = "卐卐卐卐" + req.body.instanceID;
      const viewers = io.sockets.adapter.rooms.get(req.body.username + suffix);
      const emission = await client
        .db(req.body.instanceID)
        .collection("emissions")
        .findOneAndUpdate(
          {
            emissionID: req.body.emissionID,
          },
          {
            $inc: {
              views: viewers?.size ? viewers.size : 0,
            },
          },
          {
            returnDocument: "after",
          }
        );

      if (!emission) return res.sendStatus(404);
      delete emission.headers;
      const signalBoost = emission.signalBoost
        ? await client
            .db(req.body.instanceID)
            .collection("emissions")
            .findOneAndUpdate(
              {
                emissionID: emission.signalBoost,
              },
              {
                $inc: {
                  views: viewers?.size ? viewers.size : 0,
                },
              },
              {
                returnDocument: "after",
              }
            )
        : false;
      if (signalBoost) delete signalBoost.headers;
      res.status(200).json({
        views: emission.views,
        signalBoost: signalBoost?.views,
      });
    } catch (err) {
      console.log("increment viewers error", err);
      res.sendStatus(500);
    }
  });

  routes.post("/hashtag", async (req, res) => {
    try {
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);

      const suffix = "卐卐卐卐" + req.body.instanceID;
      for (let h = 0; h < req.body.hashtags.length; h++) {
        const tag =
          req.body.hashtags[h]
            .split("/")[0]
            .replace(/^[\W_]+/g, "")
            .toLowerCase() + "卐卐";
        const tagAttendees = Array.from(
          io.sockets.adapter.rooms.get(tag) || []
        );
        const sessionsAffected = Array.from(io.sockets.sockets)
          .filter((s) => tagAttendees.indexOf(s[0]) > -1)
          .map((s) => s[1].request.sessionID);

        await client
          .db("sessionServer")
          .collection("sessions")
          .updateMany(
            {
              _id: {
                $in: sessionsAffected,
              },
            },
            {
              $push: {
                [`session.${req.body.instanceID}.emissionsCollected`]:
                  req.body.emission.emissionID,
              },
            }
          );

        emitter.to(tag + suffix).emit("new-emission", req.body.emission);
      }
      res.sendStatus(200);
    } catch (err) {
      console.log("hashtag error", err);
      res.sendStatus(500);
    }
  });

  routes.post("/new-signalboost", async (req, res) => {
    try {
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);

      let emission = req.body.emission;
      const host = req.body.host;
      emission.signalBoost.userLikes = h.getUserLikes(
        io,
        emission.signalBoost,
        host
      );
      await client
        .db("sessionServer")
        .collection("sessions")
        .updateMany(
          {
            [`session.${host}.profile`]: req.body.userID,
          },
          {
            $push: {
              [`session.${host}.emissionsCollected`]: emission.emissionID,
            },
          }
        );

      const suffix = "卐卐卐卐" + req.body.instanceID;
      const viewers = io.sockets.adapter.rooms.get(req.body.username + suffix);
      await client
        .db(req.body.instanceID)
        .collection("emissions")
        .updateMany(
          {
            $or: [
              {
                emissionID: req.body.emission.emissionID,
              },
              {
                emissionID: req.body.emission.signalBoost.emissionID,
              },
            ],
          },
          {
            $inc: {
              views: viewers?.size ? viewers.size : 0,
            },
          }
        );
      emitter.to(req.body.username + suffix).emit("new-emission", {
        ...emission,
        ignoreSelf: true,
      });
      res.status(200).json({
        views: viewers?.size || 0,
      });
    } catch (err) {
      console.log("New signalboost error", err);
      res.sendStatus(500);
    }
  });

  routes.post("/like-by-userid", async (req, res) => {
    try {
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);

      let emission = req.body.emission;
      emission.userLikes = h.getUserLikes(io, emission, req.body.host);
      const suffix = "卐卐卐卐" + req.body.instanceID;
      const viewers = io.sockets.adapter.rooms.get(req.body.username + suffix);
      const addedViews = viewers?.size || 0;
      await client
        .db(req.body.instanceID)
        .collection("emissions")
        .updateMany(
          {
            $or: [
              {
                emissionID: emission.emissionID,
              },
              {
                emissionID: emission.signalBoost,
              },
            ],
          },
          {
            $inc: {
              views: addedViews,
            },
          }
        );
      emission.views += addedViews;
      if (emission.signalBoost) {
        emission.signalBoost = await client
          .db(req.body.instanceID)
          .collection("emissions")
          .aggregate([
            {
              $lookup: {
                from: "users",
                localField: "userID",
                foreignField: "_id",
                as: "userInfo",
              },
            },
            {
              $unwind: "$userInfo",
            },
            {
              $match: {
                emissionID: emission.signalBoost,
              },
            },
            {
              $project: {
                _id: 1,
                replyID: 1,
                threadID: 1,
                emissionID: 1,
                signalBoost: 1,
                files: 1,
                html: 1,
                pollID: 1,
                userID: 1,
                username: 1,
                timestamp: 1,
                likes: 1,
                signalBoosts: 1,
                replies: 1,
                avatar: "$userInfo.avatar",
                displayName: "$userInfo.displayName",
                remove: 1,
              },
            },
          ])
          .toArray();
        emission.signalBoost = emission.signalBoost[0];
        delete emission.signalBoost.headers;
        emission.signalBoost.userLikes = h.getUserLikes(
          io,
          emission.signalBoost,
          req.body.host
        );
      }

      const sessionsAffected = await client
        .db("sessionServer")
        .collection("sessions")
        .find({
          [`session.${req.body.host}.emissionsCollected`]: emission.emissionID,
          $or: [
            {
              [`session.${req.body.host}.tempID`]: {
                $ne: null,
              },
            },
            {
              [`session.${req.body.host}.userInfo`]: {
                $ne: null,
              },
            },
          ],
        })
        .toArray();
      const usersAffected = h.getUsersAffected(sessionsAffected, req.body.host);
      usersAffected
        .map((user) => {
          if (user.session[req.body.host].userInfo)
            return user.session[req.body.host].userInfo._id;
          return user.session[req.body.host].tempID;
        })
        .forEach((recipient) => {
          emitter.to(recipient + suffix).emit("like", {
            emissionID: req.body.emissionID,
            userID: req.body.userID,
            value: req.body.alreadyLiked,
            emission: emission,
          });
        });
      res.status(200).json({
        emission: emission,
      });
    } catch (err) {
      console.log("Like by userid error", err);
      res.sendStatus(500);
    }
  });

  routes.post("/pin-unpin", async (req, res) => {
    try {
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);
      let emission = req.body.emission;
      emission.userLikes = h.getUserLikes(io, emission, req.body.host);
      if (emission.pollID)
        emission.pollData = await c.getPollData(
          io,
          emission,
          client.db(req.body.instanceID)
        );
      if (emission.signalBoost) {
        emission.signalBoost.userLikes = h.getUserLikes(
          io,
          emission.signalBoost,
          req.body.host
        );
        if (emission.signalBoost.pollID)
          emission.signalBoost.pollData = await c.getPollData(
            io,
            emission.signalBoost,
            client.db(req.body.instanceID)
          );
      }

      if (emission.replyEmission) {
        emission.replyEmission.userLikes = h.getUserLikes(
          io,
          emission.replyEmission,
          req.body.host
        );
        if (emission.replyEmission.pollID)
          emission.replyEmission.pollData = await c.getPollData(
            io,
            emission.replyEmission,
            client.db(req.body.instanceID)
          );
        if (emission.replyEmission.signalBoost) {
          emission.replyEmission.signalBoost.userLikes = h.getUserLikes(
            io,
            emission.replyEmission.signalBoost,
            req.body.host
          );
          if (emission.replyEmission.signalBoost.pollID)
            emission.replyEmission.signalBoost.pollData = await c.getPollData(
              io,
              emission.replyEmission.signalBoost,
              client.db(req.body.instanceID)
            );
        }
        if (emission.replyEmission.replyEmission) {
          emission.replyEmission.replyEmission.userLikes = h.getUserLikes(
            io,
            emission.replyEmission.replyEmission,
            req.body.host
          );
          if (emission.replyEmission.replyEmission.pollID)
            emission.replyEmission.replyEmission.pollData = await c.getPollData(
              io,
              emission.replyEmission.replyEmission,
              client.db(req.body.instanceID)
            );
          if (emission.replyEmission.replyEmission.signalBoost) {
            emission.replyEmission.replyEmission.signalBoost.userLikes =
              h.getUserLikes(
                io,
                emission.replyEmission.replyEmission.signalBoost,
                req.body.host
              );
            if (emission.replyEmission.replyEmission.signalBoost.pollID)
              emission.replyEmission.replyEmission.signalBoost.pollData =
                await c.getPollData(
                  io,
                  emission.replyEmission.replyEmission.signalBoost,
                  client.db(req.body.instanceID)
                );
          }
        }
      }

      await client
        .db("sessionServer")
        .collection("sessions")
        .updateMany(
          {
            [`session.${req.body.host}.profile`]: req.body.userID,
          },
          {
            $push: {
              [`session.${req.body.host}.emissionsCollected`]:
                emission.emissionID,
            },
          }
        );
      const suffix = "卐卐卐卐" + req.body.instanceID;
      emitter.to(req.body.userID + suffix).emit("pin", emission);
      res.status(200).json({
        updatedEmission: emission,
      });
    } catch (err) {
      console.log("Pin unpin error", err);
      res.sendStatus(500);
    }
  });

  routes.post("/post-reply", async (req, res) => {
    try {
      if (req.body.socketKey !== process.env.SOCKET_KEY)
        return res.sendStatus(401);
      let emission = req.body.emission;
      const sessionDB = client.db("sessionServer");
      emission.replyEmission.userLikes = h.getUserLikes(
        io,
        emission.replyEmission,
        req.body.host
      );
      if (emission.replyEmission.pollID)
        emission.replyEmission.pollData = await c.getPollData(
          io,
          emission.replyEmission,
          client.db(req.body.instanceID)
        );
      if (emission.replyEmission.signalBoost) {
        emission.replyEmission.signalBoost.userLikes = h.getUserLikes(
          io,
          emission.replyEmission.signalBoost,
          req.body.host
        );
        if (emission.replyEmission.signalBoost.pollID)
          emission.replyEmission.signalBoost.pollData = await c.getPollData(
            io,
            emission.replyEmission.signalBoost,
            client.db(req.body.instanceID)
          );
      }
      if (emission.replyEmission.replyEmission) {
        emission.replyEmission.replyEmission.userLikes = h.getUserLikes(
          io,
          emission.replyEmission.replyEmission,
          req.body.host
        );
        if (emission.replyEmission.replyEmission.pollID)
          emission.replyEmission.replyEmission.pollData = await c.getPollData(
            io,
            emission.replyEmission.replyEmission,
            client.db(req.body.instanceID)
          );
        if (emission.replyEmission.replyEmission.signalBoost) {
          emission.replyEmission.replyEmission.signalBoost.userLikes =
            h.getUserLikes(
              io,
              emission.replyEmission.replyEmission.signalBoost,
              req.body.host
            );
          if (emission.replyEmission.replyEmission.signalBoost.pollID)
            emission.replyEmission.replyEmission.signalBoost.pollData =
              await c.getPollData(
                io,
                emission.replyEmission.replyEmission.signalBoost,
                client.db(req.body.instanceID)
              );
        }
      }
      await sessionDB.collection("sessions").updateMany(
        {
          [`session.${req.body.host}.profile`]: emission.userID,
        },
        {
          $push: {
            [`session.${req.body.host}.emissionsCollected`]:
              emission.emissionID,
          },
        }
      );
      const sessionsAffected = await sessionDB
        .collection("sessions")
        .find({
          [`session.${req.body.host}.emissionsCollected`]: req.body.replyID,
          $or: [
            {
              [`session.${req.body.host}.tempID`]: {
                $ne: null,
              },
            },
            {
              [`session.${req.body.host}.userInfo`]: {
                $ne: null,
              },
            },
          ],
        })
        .toArray();
      const usersAffected = h.getUsersAffected(sessionsAffected, req.body.host);
      const newEmissionRecipients = [];
      const replyRecipients = [];

      usersAffected.forEach((user) => {
        if (user.session[req.body.host].userInfo) {
          replyRecipients.push(user.session[req.body.host].userInfo._id);
          if (user.session[req.body.host].profile === emission.userID)
            newEmissionRecipients.push(
              user.session[req.body.host].userInfo._id
            );
        } else {
          replyRecipients.push(user.session[req.body.host].tempID);
          if (user.session[req.body.host].profile === emission.userID)
            newEmissionRecipients.push(user.session[req.body.host].tempID);
        }
      });
      const suffix = "卐卐卐卐" + req.body.instanceID;
      replyRecipients.forEach((recipient) => {
        emitter.to(recipient + suffix).emit("reply", req.body.replyID);
      });
      newEmissionRecipients.forEach((recipient) => {
        emitter.to(recipient + suffix).emit("new-emission", emission);
      });
      res.status(200).json({
        emission: emission,
      });
    } catch (err) {
      console.log("Post reply error", err);
      res.sendStatus(500);
    }
  });

  return routes;
};

module.exports = (io, emitter) => moduleExports(io, emitter);

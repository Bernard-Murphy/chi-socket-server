const h = require("./helpers");

const c = {};

/**
 *
 * @param {Object} constraint - MongoDB constraint object
 * @param {Object} userInfo - Users document
 * @param {Boolean} skipMetadata - Whether to skip the metadata application process
 * @returns Single emission with the constraints and metadata if desired
 */
c.getEmission = async (constraint, context, skipMetadata) => {
  try {
    const userInfo = context.session.userInfo;
    const db = context.mongoClient.db(context.instanceInfo.instanceID);
    const Emissions = db.collection("emissions");
    let emission = await Emissions.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userID",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $lookup: {
          from: "polls",
          localField: "pollID",
          foreignField: "_id",
          as: "pollData",
        },
      },
      {
        $unwind: {
          path: "$pollData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          as: "boost",
          from: "emissions",
          let: { id: "$signalBoost" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$emissionID", "$$id"] },
              },
            },
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
              $lookup: {
                from: "polls",
                localField: "pollID",
                foreignField: "_id",
                as: "pollData",
              },
            },
            {
              $unwind: {
                path: "$pollData",
                preserveNullAndEmptyArrays: true,
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
                pollData: "$pollData",
                pollID: 1,
                userID: 1,
                username: 1,
                timestamp: 1,
                likes: 1,
                signalBoosts: 1,
                comments: 1,
                avatar: "$userInfo.avatar",
                displayName: "$userInfo.displayName",
                remove: 1,
                replies: 1,
                private: "$userInfo.private",
                blocksMe: "$userInfo.blocked",
                user_id: "$userInfo.user_id",
                role: "$userInfo.role",
                verified: "$userInfo.verified",
                views: 1,
                pinned: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$boost",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          as: "replyEmission",
          from: "emissions",
          let: { id: "$replyID" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$emissionID", "$$id"] },
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "userID",
                foreignField: "_id",
                as: "userInfo",
              },
            },
            {
              $lookup: {
                from: "polls",
                localField: "pollID",
                foreignField: "_id",
                as: "pollData",
              },
            },
            {
              $unwind: {
                path: "$pollData",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                as: "replyEmission",
                from: "emissions",
                let: { id_inner: "$replyID" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$emissionID", "$$id_inner"] },
                    },
                  },
                  {
                    $lookup: {
                      from: "users",
                      localField: "userID",
                      foreignField: "_id",
                      as: "userInfo",
                    },
                  },
                  {
                    $lookup: {
                      from: "polls",
                      localField: "pollID",
                      foreignField: "_id",
                      as: "pollData",
                    },
                  },
                  {
                    $unwind: {
                      path: "$pollData",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $lookup: {
                      as: "boost",
                      from: "emissions",
                      let: { id: "$signalBoost" },
                      pipeline: [
                        {
                          $match: {
                            $expr: { $eq: ["$emissionID", "$$id"] },
                          },
                        },
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
                          $lookup: {
                            from: "polls",
                            localField: "pollID",
                            foreignField: "_id",
                            as: "pollData",
                          },
                        },
                        {
                          $unwind: {
                            path: "$pollData",
                            preserveNullAndEmptyArrays: true,
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
                            pollData: "$pollData",
                            pollID: 1,
                            userID: 1,
                            username: 1,
                            timestamp: 1,
                            likes: 1,
                            signalBoosts: 1,
                            comments: 1,
                            avatar: "$userInfo.avatar",
                            displayName: "$userInfo.displayName",
                            remove: 1,
                            replies: 1,
                            private: "$userInfo.private",
                            blocksMe: "$userInfo.blocked",
                            user_id: "$userInfo.user_id",
                            role: "$userInfo.role",
                            verified: "$userInfo.verified",
                            views: 1,
                            pinned: 1,
                          },
                        },
                      ],
                    },
                  },
                  {
                    $unwind: {
                      path: "$boost",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $unwind: "$userInfo",
                  },
                  {
                    $project: {
                      _id: 1,
                      replyID: 1,
                      threadID: 1,
                      emissionID: 1,
                      signalBoost: "$boost",
                      files: 1,
                      html: 1,
                      pollData: "$pollData",
                      pollID: 1,
                      userID: 1,
                      username: 1,
                      timestamp: 1,
                      likes: 1,
                      signalBoosts: 1,
                      comments: 1,
                      avatar: "$userInfo.avatar",
                      displayName: "$userInfo.displayName",
                      remove: 1,
                      replies: 1,
                      private: "$userInfo.private",
                      blocksMe: "$userInfo.blocked",
                      user_id: "$userInfo.user_id",
                      role: "$userInfo.role",
                      verified: "$userInfo.verified",
                      views: 1,
                      pinned: 1,
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                as: "boost",
                from: "emissions",
                let: { id: "$signalBoost" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$emissionID", "$$id"] },
                    },
                  },
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
                    $lookup: {
                      from: "polls",
                      localField: "pollID",
                      foreignField: "_id",
                      as: "pollData",
                    },
                  },
                  {
                    $unwind: {
                      path: "$pollData",
                      preserveNullAndEmptyArrays: true,
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
                      pollData: "$pollData",
                      pollID: 1,
                      userID: 1,
                      username: 1,
                      timestamp: 1,
                      likes: 1,
                      signalBoosts: 1,
                      comments: 1,
                      avatar: "$userInfo.avatar",
                      displayName: "$userInfo.displayName",
                      remove: 1,
                      replies: 1,
                      private: "$userInfo.private",
                      blocksMe: "$userInfo.blocked",
                      user_id: "$userInfo.user_id",
                      role: "$userInfo.role",
                      verified: "$userInfo.verified",
                      views: 1,
                      pinned: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: "$boost",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: "$userInfo",
            },
            {
              $unwind: {
                path: "$replyEmission",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                replyID: 1,
                threadID: 1,
                emissionID: 1,
                signalBoost: "$boost",
                files: 1,
                html: 1,
                pollData: "$pollData",
                pollID: 1,
                userID: 1,
                username: 1,
                timestamp: 1,
                likes: 1,
                signalBoosts: 1,
                comments: 1,
                avatar: "$userInfo.avatar",
                displayName: "$userInfo.displayName",
                remove: 1,
                replyEmission: "$replyEmission",
                replies: 1,
                private: "$userInfo.private",
                blocksMe: "$userInfo.blocked",
                user_id: "$userInfo.user_id",
                role: "$userInfo.role",
                verified: "$userInfo.verified",
                views: 1,
                pinned: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $unwind: {
          path: "$replyEmission",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: constraint,
      },
      {
        $project: {
          _id: 1,
          replyID: 1,
          threadID: 1,
          emissionID: 1,
          signalBoost: "$boost",
          files: 1,
          html: 1,
          pollData: "$pollData",
          pollID: 1,
          userID: 1,
          username: 1,
          timestamp: 1,
          likes: 1,
          signalBoosts: 1,
          comments: 1,
          avatar: "$userInfo.avatar",
          displayName: "$userInfo.displayName",
          remove: 1,
          replyEmission: "$replyEmission",
          replies: 1,
          private: "$userInfo.private",
          blocksMe: "$userInfo.blocked",
          user_id: "$userInfo.user_id",
          role: "$userInfo.role",
          verified: "$userInfo.verified",
          views: 1,
          pinned: 1,
        },
      },
    ]).toArray();
    if (emission.length) {
      emission = await c.trimPollData(emission, context);

      emission = emission[0];

      emission = {
        ...emission,
        blocksMe: userInfo
          ? emission.blocksMe.indexOf(userInfo.user_id) > -1
            ? true
            : false
          : false,
        isBlocked: userInfo
          ? userInfo.blocked.indexOf(emission.user_id) > -1
            ? true
            : false
          : false,
        views: emission.views + 1,
        signalBoost: emission.signalBoost
          ? {
              ...emission.signalBoost,
              blocksMe: userInfo
                ? emission.signalBoost.blocksMe.indexOf(userInfo.user_id) > -1
                  ? true
                  : false
                : false,
              isBlocked: userInfo
                ? userInfo.blocked.indexOf(emission.signalBoost.user_id) > -1
                  ? true
                  : false
                : false,
              views: emission.signalBoost.views + 1,
            }
          : false,
        replyEmission: emission.replyEmission
          ? {
              ...emission.replyEmission,
              blocksMe: userInfo
                ? emission.replyEmission.blocksMe.indexOf(userInfo.user_id) > -1
                  ? true
                  : false
                : false,
              isBlocked: userInfo
                ? userInfo.blocked.indexOf(emission.replyEmission.user_id) > -1
                  ? true
                  : false
                : false,
              views: emission.replyEmission.views + 1,
              signalBoost: emission.replyEmission.signalBoost
                ? {
                    ...emission.replyEmission.signalBoost,
                    blocksMe: userInfo
                      ? emission.replyEmission.signalBoost.blocksMe.indexOf(
                          userInfo.user_id
                        ) > -1
                        ? true
                        : false
                      : false,
                    isBlocked: userInfo
                      ? userInfo.blocked.indexOf(
                          emission.replyEmission.signalBoost.user_id
                        ) > -1
                        ? true
                        : false
                      : false,
                    views: emission.replyEmission.views + 1,
                  }
                : false,
              replyEmission: emission.replyEmission.replyEmission
                ? {
                    ...emission.replyEmission.replyEmission,
                    blocksMe: userInfo
                      ? emission.replyEmission.replyEmission.blocksMe.indexOf(
                          userInfo.user_id
                        ) > -1
                        ? true
                        : false
                      : false,
                    isBlocked: userInfo
                      ? userInfo.blocked.indexOf(
                          emission.replyEmission.replyEmission.user_id
                        ) > -1
                        ? true
                        : false
                      : false,
                    views: emission.replyEmission.replyEmission.views + 1,
                    signalBoost: emission.replyEmission.replyEmission
                      .signalBoost
                      ? {
                          ...emission.replyEmission.replyEmission.signalBoost,
                          blocksMe: userInfo
                            ? emission.replyEmission.replyEmission.signalBoost.blocksMe.indexOf(
                                userInfo.user_id
                              ) > -1
                              ? true
                              : false
                            : false,
                          isBlocked: userInfo
                            ? userInfo.blocked.indexOf(
                                emission.replyEmission.replyEmission.signalBoost
                                  .user_id
                              ) > -1
                              ? true
                              : false
                            : false,
                          views:
                            emission.replyEmission.replyEmission.signalBoost
                              .views + 1,
                        }
                      : false,
                  }
                : false,
            }
          : false,
      };

      if (!skipMetadata) {
        emission = {
          ...emission,
          liked: userInfo
            ? userInfo.likes.indexOf(emission.emissionID) > -1
            : false,
          pollData: emission.pollData
            ? {
                ...emission.pollData,
                voted: userInfo
                  ? emission.pollData.voters.find(
                      (voter) => voter.userID === userInfo._id
                    ) !== undefined
                  : false,
              }
            : false,
          signalBoost: emission.signalBoost
            ? {
                ...emission.signalBoost,
                liked: userInfo
                  ? userInfo.likes.indexOf(emission.signalBoost.emissionID) > -1
                  : false,
                pollData: emission.signalBoost.pollData
                  ? {
                      ...emission.signalBoost.pollData,
                      voted: userInfo
                        ? emission.signalBoost.pollData.voters.find(
                            (voter) => voter.userID === userInfo._id
                          ) !== undefined
                        : false,
                    }
                  : false,
              }
            : false,
          replyEmission: emission.replyEmission
            ? {
                ...emission.replyEmission,
                liked: userInfo
                  ? userInfo.likes.indexOf(emission.replyEmission.emissionID) >
                    -1
                  : false,
                pollData: emission.replyEmission.pollData
                  ? {
                      ...emission.replyEmission.pollData,
                      voted: userInfo
                        ? emission.replyEmission.pollData.voters.find(
                            (voter) => voter.userID === userInfo._id
                          ) !== undefined
                        : false,
                    }
                  : false,
                signalBoost: emission.replyEmission.signalBoost
                  ? {
                      ...emission.replyEmission.signalBoost,
                      liked: userInfo
                        ? userInfo.likes.indexOf(
                            emission.replyEmission.signalBoost.emissionID
                          ) > -1
                        : false,
                      pollData: emission.replyEmission.signalBoost.pollData
                        ? {
                            ...emission.replyEmission.signalBoost.pollData,
                            voted: userInfo
                              ? emission.replyEmission.signalBoost.pollData.voters.find(
                                  (voter) => voter.userID === userInfo._id
                                ) !== undefined
                              : false,
                          }
                        : false,
                    }
                  : false,
                replyEmission: emission.replyEmission.replyEmission
                  ? {
                      ...emission.replyEmission.replyEmission,
                      liked: userInfo
                        ? userInfo.likes.indexOf(
                            emission.replyEmission.replyEmission.emissionID
                          ) > -1
                        : false,
                      pollData: emission.replyEmission.replyEmission.pollData
                        ? {
                            ...emission.replyEmission.replyEmission.pollData,
                            voted: userInfo
                              ? emission.replyEmission.replyEmission.pollData.voters.find(
                                  (voter) => voter.userID === userInfo._id
                                ) !== undefined
                              : false,
                          }
                        : false,
                      signalBoost: emission.replyEmission.replyEmission
                        .signalBoost
                        ? {
                            ...emission.replyEmission.replyEmission.signalBoost,
                            liked: userInfo
                              ? userInfo.likes.indexOf(
                                  emission.replyEmission.replyEmission
                                    .signalBoost.emissionID
                                ) > -1
                              : false,
                            pollData: emission.replyEmission.replyEmission
                              .signalBoost.pollData
                              ? {
                                  ...emission.replyEmission.replyEmission
                                    .signalBoost.pollData,
                                  voted: userInfo
                                    ? emission.replyEmission.replyEmission.signalBoost.pollData.voters.find(
                                        (voter) => voter.userID === userInfo._id
                                      ) !== undefined
                                    : false,
                                }
                              : false,
                          }
                        : false,
                    }
                  : false,
              }
            : false,
        };
      }

      emission = h.filterRemoved([emission], userInfo, context)[0];

      return emission;
    } else return false;
  } catch (err) {
    console.log("Get emission error", err);
    return false;
  }
};

/**
 *
 * @param {Socket} io - Socket.io socket object
 * @param {Object} emission - Emissions document
 * @returns Array of User _ids that voted in the emission's poll
 */
c.getPollData = async (io, emission, db) => {
  const Polls = db.collection("polls");
  const Users = db.collection("users");
  const pollData = await Polls.findOne({ _id: emission.pollID });
  if (!pollData) return false;
  pollData.voters = pollData.voters.filter((voter, v) => {
    if (v < 100) return true;
    return Object.keys(io.engine.clients).find((key) => {
      if (
        !io.engine.clients[key]?.request?.session ||
        !io.engine.clients[key].request.session[host]?.userInfo
      )
        return false;
      return (
        io.engine.clients[key].request.session[host]?.userInfo._id ===
        voter.userID
      );
    });
  });
  const userIDs = [];
  pollData.voters.forEach((voter) => userIDs.push(voter.userID));
  if (userIDs.length) {
    const users = await Users.find({ _id: { $in: userIDs } }).toArray();
    users.forEach((user) =>
      pollData.voters.forEach((voter, v) => {
        if (voter.userID === user._id)
          pollData.voters[v] = {
            ...pollData.voters[v],
            ...h.returnClientUserInfo(user, true),
          };
      })
    );
  }
  return pollData;
};

module.exports = c;

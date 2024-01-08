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

const getOpenReports = (options) => {
  const { instanceID } = options;
  new Promise(async (resolve, reject) =>
    connect(instanceID, async (db) => {
      try {
        const reports = await db
          .collection("reports")
          .find({
            dismissed: false,
          })
          .toArray();
        let open = [
          ...new Set(
            reports
              .filter((r) => r.type === "emission")
              .map((r) => r.emissionID)
          ),
          ...new Set(
            reports.filter((r) => r.type === "user").map((r) => r.user_id)
          ),
          ...reports.filter((r) => r.type === "approval"),
        ];
        resolve(open.length);
      } catch (err) {
        reject(err);
      }
    })
  );
};

module.exports = getOpenReports;

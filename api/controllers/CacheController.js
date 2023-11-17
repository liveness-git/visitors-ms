/**
 * CacheController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");
const MSCache = require("../services/MSCache");
const moment = require("moment-timezone");

const ownerEmail = sails.config.visitors.credential.username;

module.exports = {
  saveEvents: async (req, res) => {
    try {
      //TODO: 認証処理を追加すること
      //TODO: 認証処理を追加すること
      //TODO: 認証処理を追加すること

      // 取得期間の設定
      const timestamp = Number(req.query.timestamp);
      const startTimestamp = moment(timestamp).startOf("date");
      const endTimestamp = moment(timestamp).endOf("date").add(1, "months");

      // 代表アカウント設定
      const localAccountId = await MSAuth.acquireOwnerAccountId();
      // msalから有効なaccessToken取得(代表)
      const ownerToken = await MSAuth.acquireToken(localAccountId);

      // graphAPIからevent取得
      const events = await MSGraph.getCalendarEvents(ownerToken, ownerEmail, {
        startDateTime: moment(startTimestamp).format(),
        endDateTime: moment(endTimestamp).format(),
        $orderBy: "start/dateTime",
        $select: MSGraph.visitorsSelecter,
        $filter: `categories/any(c:c eq '${MSGraph.getVisitorsLabel()}')`,
      });

      await MSCache.saveAllEvents(events);

      return res.send("Hi there!");
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },
};

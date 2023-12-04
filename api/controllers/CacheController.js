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
  /**
   * キャッシュ全削除後、指定期間のイベントを全登録
   * @param {*} req
   * @param {*} res
   * @returns
   */
  saveEvents: async (req, res) => {
    try {
      // キャッシュ保持期間の設定
      const timestamp = !!req.query.timestamp
        ? Number(req.query.timestamp)
        : new Date().getTime();
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

      // キャッシュ全削除
      await EventCache.destroy({});
      // 指定期間のイベントを全登録
      await MSCache.saveAllEvents(events);

      // キャッシュログ作成
      await CacheLog.create({
        type: "event",
        mode: "reset",
        start: startTimestamp.toDate(),
        end: endTimestamp.toDate(),
      });

      return res.send("Hi there!");
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },
};

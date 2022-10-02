/**
 * EventController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");
const moment = require("moment-timezone");
const { map } = require("p-iteration");

const isOwnerMode = sails.config.visitors.isOwnerMode;
const ownerEmail = sails.config.visitors.credential.username;

module.exports = {
  export: async (req, res) => {
    try {
      const data = req.body.inputs;

      // 取得期間の設定
      // const timestamp = Number(req.query.timestamp);
      const startTimestamp = moment(data.startDate).startOf("date");
      const endTimestamp = moment(data.endDate).endOf("date");

      // msalから有効なaccessToken取得(代表)
      const ownerToken = await MSAuth.acquireToken(
        req.session.owner.localAccountId
      );

      const location = await Location.findOne({ url: data.location });

      let events = [];
      if (isOwnerMode) {
        // graphAPIからevent取得し対象ロケーションの会議室予約のみにフィルタリング。
        events = await sails.helpers.getTargetFromEvents(
          MSGraph.getLocationLabel(location.id),
          ownerToken,
          ownerEmail,
          startTimestamp,
          endTimestamp,
          data.location
        );
      } else {
        // TODO: 会議室単位で取得ループ
      }

      // GraphAPIのevent情報とVisitor情報をマージ
      const $result = await map(events, async (event) => {
        return await sails.helpers.attachVisitorData(
          event,
          req.session.user.email,
          true
        );
      });

      // 会議室status=accepted & 社外会議 のみに絞り込む(front/visitlist にも同じ処理あり)
      const result = $result.filter((event) => {
        return (
          Object.keys(event.resourcies).some(
            (key) => event.resourcies[key].roomStatus === "accepted"
          ) && event.usageRange === "outside"
        );
      });

      return res.json({ success: true, value: result });
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },

  checkin: async (req, res) => {
    try {
      const data = req.body.inputs;
      const visitorId = data.id;

      const visitor = await Visitor.updateOne(visitorId).set({
        checkIn: data.checkIn,
        visitorCardNumber: data.visitorCardNumber,
      });

      if (!!visitor) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },

  checkout: async (req, res) => {
    try {
      const data = req.body.inputs;
      const visitorId = data.id;

      const visitor = await Visitor.updateOne(visitorId).set({
        checkOut: data.checkOut,
        visitorCardNumber: data.visitorCardNumber,
      });

      if (!!visitor) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },

  visitList: async (req, res) => {
    try {
      // 取得期間の設定
      const timestamp = Number(req.query.timestamp);
      const startTimestamp = moment(timestamp).startOf("date");
      const endTimestamp = moment(timestamp).endOf("date");

      // msalから有効なaccessToken取得(代表)
      const ownerToken = await MSAuth.acquireToken(
        req.session.owner.localAccountId
      );

      const location = await Location.findOne({ url: req.query.location });

      let events = [];
      if (isOwnerMode) {
        // graphAPIからevent取得し対象ロケーションの会議室予約のみにフィルタリング。
        events = await sails.helpers.getTargetFromEvents(
          MSGraph.getLocationLabel(location.id),
          ownerToken,
          ownerEmail,
          startTimestamp,
          endTimestamp,
          req.query.location
        );
      } else {
        // TODO: 会議室単位で取得ループ
      }

      // GraphAPIのevent情報とVisitor情報をマージ
      const $result = await map(events, async (event) => {
        return await sails.helpers.attachVisitorData(
          event,
          req.session.user.email,
          true
        );
      });

      // 会議室status=accepted & 社外会議 のみに絞り込む(front/export にも同じ処理あり)
      const result = $result.filter((event) => {
        return (
          Object.keys(event.resourcies).some(
            (key) => event.resourcies[key].roomStatus === "accepted"
          ) && event.usageRange === "outside"
        );
      });

      return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};

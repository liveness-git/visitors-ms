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
          data.location,
          "not-used" //キャッシュ利用しない
        );
      } else {
        // TODO: 会議室単位で取得ループ
      }

      // GraphAPIのevent情報とVisitor情報をマージ
      const $result = (
        await map(events, async (event) => {
          return await sails.helpers.attachVisitorData(
            event,
            req.session.user.email,
            true
          );
        })
      ).filter((v) => v);

      // 会議室status=accepted & 社外会議 のみに絞り込む(front/visitlist にも同じ処理あり)
      const result = $result.filter((event) => {
        return (
          Object.keys(event.resourcies).some(
            (key) => event.resourcies[key].roomStatus === "accepted"
          ) && event.usageRange === "outside"
        );
      });

      // 定期的な予定が含まれる場合、ソートが崩れる為もう一度並び換える。
      result.sort((a, b) => a.startDateTime - b.startDateTime);

      return res.json({ success: true, value: result });
    } catch (err) {
      sails.log.error("FrontController.export(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },

  checkin: async (req, res) => {
    try {
      const data = req.body.inputs;
      const visitorId = data.id;

      const checkin = {
        checkIn: data.checkIn,
        visitorCardNumber: data.visitorCardNumber,
      };

      // 定期イベントの場合、GraphAPIのtype:occurrence → exception に変更
      if (!!data.seriesMasterId) {
        // msalから有効なaccessToken取得(代表)
        const ownerToken = await MSAuth.acquireToken(
          req.session.owner.localAccountId
        );
        // iCalUIdからevent取得
        // ** 定期イベント(今回のみ)の場合
        const $ = (
          await MSGraph.getEventsBySeriesMasterId(
            ownerToken,
            ownerEmail,
            data.seriesMasterId,
            data.iCalUId
          )
        )[0];
        if (!$) {
          throw new Error("Could not obtain MSGraph Event to update.");
        }
        // 空更新
        const event = await MSGraph.patchEvent(
          ownerToken,
          ownerEmail,
          $.id,
          {}
        );
        if (!event) {
          throw new Error("Failed to update MSGraph Event data.");
        }
        checkin.eventType = event.type; // 最新のtypeに変更
      }

      const visitor = await Visitor.updateOne(visitorId).set({ ...checkin });

      if (!!visitor) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error("FrontController.checkin(): ", err.message);
      return MSGraph.errorHandler(res, err);
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
      sails.log.error("FrontController.checkout(): ", err.message);
      return MSGraph.errorHandler(res, err);
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

      // if (isOwnerMode) {
      // graphAPIからevent取得し対象ロケーションの会議室予約のみにフィルタリング。
      const events = await sails.helpers.getTargetFromEvents(
        MSGraph.getLocationLabel(location.id),
        ownerToken,
        ownerEmail,
        startTimestamp,
        endTimestamp,
        req.query.location
      );
      // } else {
      //   // TODO: 会議室単位で取得ループ
      // }

      // GraphAPIのevent情報とVisitor情報をマージ
      const $result = (
        await map(events, async (event) => {
          return await sails.helpers.attachVisitorData(
            event,
            req.session.user.email,
            true
          );
        })
      ).filter((v) => v);

      // 会議室status=accepted & 社外会議 のみに絞り込む(front/export にも同じ処理あり)
      const result = $result.filter((event) => {
        return (
          Object.keys(event.resourcies).some(
            (key) => event.resourcies[key].roomStatus === "accepted"
          ) && event.usageRange === "outside"
        );
      });

      // 定期的な予定が含まれる場合、ソートが崩れる為もう一度並び換える。
      result.sort((a, b) => a.startDateTime - b.startDateTime);

      return res.json(result);
    } catch (err) {
      sails.log.error("FrontController.visitList(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },
};

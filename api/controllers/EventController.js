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

module.exports = {
  create: async (req, res) => {
    try {
      const data = req.body.inputs;

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

      // event情報をgraphAPIに渡せるように成型
      const [event, errors] = await MSGraph.generateEventData(
        data,
        accessToken,
        req.session.user.email
      );

      // 入力エラーの場合
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      // graphAPIからevent登録
      const $ = await MSGraph.postEvent(
        accessToken,
        req.session.user.email,
        event
      );

      // visitor登録
      const visitor = await Visitor.create({
        iCalUId: $.iCalUId,
        visitCompany: data.visitCompany,
        visitorName: data.visitorName,
        resourcies: await sails.helpers.generateVisitorResourcies(
          data.resourcies
        ),
        comment: data.comment,
        contactAddr: data.contactAddr,
      }).fetch();

      if (!!visitor) {
        return res.json({ success: true });
      } else {
        throw new Error("The registration process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const dirtyFields = req.body.dirtyFields;
      const data = req.body.inputs;
      const visitorId = data.visitorId;

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

      // event情報をgraphAPIに渡せるように成型
      const [updateEvent, errors] = await MSGraph.generateEventData(
        data,
        accessToken,
        req.session.user.email
      );

      // 入力エラーの場合
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      // 更新分フィールドのみ抽出
      const params = MSGraph.pickDirtyFields(updateEvent, dirtyFields);
      console.log("変更分抽出：", params);

      // iCalUIdからevent取得
      const $ = await MSGraph.getEventByIcaluid(
        accessToken,
        req.session.user.email,
        data.iCalUId
      );
      if (!$) {
        throw new Error("Could not obtain MSGraph Event to update.");
      }

      // eventの更新
      const event = MSGraph.patchEvent(
        accessToken,
        req.session.user.email,
        $.id,
        params
      );
      if (!event) {
        throw new Error("Failed to delete MSGraph Event data.");
      }

      // リソース情報だけ再加工
      const resourcies = await sails.helpers.generateVisitorResourcies(
        data.resourcies
      );
      const newData = { ...data, resourcies: resourcies };

      // visitorの更新/作成
      let visitor = null;
      if (visitorId) {
        // visitorが存在する場合はupdate
        visitor = await Visitor.updateOne(visitorId).set(newData);
      } else {
        // visitorが存在しない場合はcreate
        visitor = await Visitor.create(newData).fetch();
      }
      if (!visitor) {
        throw new Error("Failed to update Visitor data.");
      }

      return res.json({ success: true });
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const data = req.body.inputs;
      const visitorId = data.visitorId;

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );
      // iCalUIdからevent取得
      const $ = await MSGraph.getEventByIcaluid(
        accessToken,
        req.session.user.email,
        data.iCalUId
      );
      if (!$) {
        throw new Error("Could not obtain MSGraph Event to delete.");
      }
      // eventの削除
      const event = MSGraph.deleteEvent(
        accessToken,
        req.session.user.email,
        $.id
      );
      if (!event) {
        throw new Error("Failed to delete MSGraph Event data.");
      }

      // visitorが存在する場合は、visitorの削除
      if (visitorId) {
        const visitor = await Visitor.destroyOne(visitorId);
        if (!visitor) {
          throw new Error("Failed to delete Visitor data.");
        }
      }

      return res.json({ success: true });
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
      const endTimestamp = moment(timestamp).endOf("date").add(1, "months");

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

      // graphAPIからevent取得し対象ロケーションの会議室予約のみにフィルタリング。
      const events = await sails.helpers.getTargetFromEvents(
        accessToken,
        req.session.user.email,
        startTimestamp,
        endTimestamp,
        req.query.location
      );

      // GraphAPIのevent情報とVisitor情報をマージ
      const result = await map(events, async (event) => {
        return await sails.helpers.attachVisitorData(
          event,
          req.session.user.email
        );
      });

      return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },

  byRoom: async (req, res) => {
    try {
      // ロケーションの取得
      const location = await Location.findOne({ url: req.query.location });

      //会議室の取得
      const rooms = await Room.find({ location: location.id }).sort("sort ASC");

      // 取得期間の設定
      const timestamp = Number(req.query.timestamp);
      const startTimestamp = moment(timestamp).startOf("date");
      const endTimestamp = moment(timestamp).endOf("date");

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

      // graphAPIから空き時間情報
      const schedules = await MSGraph.getSchedule(
        accessToken,
        req.session.user.email,
        {
          startTime: {
            dateTime: MSGraph.getGraphDateTime(startTimestamp),
            timeZone: MSGraph.getTimeZone(),
          },
          endTime: {
            dateTime: MSGraph.getGraphDateTime(endTimestamp),
            timeZone: MSGraph.getTimeZone(),
          },
          schedules: rooms.map((room) => room.email),
        }
      );

      // graphAPIからevent取得し対象ロケーションの会議室予約のみにフィルタリング。
      const events = await sails.helpers.getTargetFromEvents(
        accessToken,
        req.session.user.email,
        startTimestamp,
        endTimestamp,
        req.query.location
      );

      // GraphAPIのevent情報とVisitor情報をマージ
      const result = await map(events, async (event) => {
        return await sails.helpers.attachVisitorData(
          event,
          req.session.user.email
        );
      });

      return res.json({ schedules: schedules, events: result });

      // TODO:画面作成時にどちらが良いかに考えること！！
      // これを使うなら、locations[0]になっているので複数会議室に対応させること
      //
      // 空き時間情報の配列の中に、該当イベントの情報も一緒にセット
      // const result = schedules.map((schedule) => {
      //   const isSameRoom = (event) => {
      //     if (
      //       event.locations.length === 0 ||
      //       !event.locations[0].hasOwnProperty("locationUri")
      //     ) {
      //       return false;
      //     }
      //     return event.locations[0s].locationUri === schedule.scheduleId;
      //   };
      //   return {
      //     ...schedule,
      //     event: targetEvents[targetEvents.findIndex(isSameRoom)],
      //   };
      // });
      // return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};

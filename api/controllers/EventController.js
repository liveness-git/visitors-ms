/**
 * EventController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");
const moment = require("moment-timezone");
const { filter, map, some } = require("p-iteration");

module.exports = {
  create: async (req, res) => {
    try {
      const data = req.body.inputs;

      // event情報をgraphAPIに渡せるように成型
      const [event, errors] = await MSGraph.generateEventData(
        data,
        req.session.user.email
      );

      // 入力エラーの場合
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

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
        resourcies: data.resourcies,
        numberOfVisitor: Number(data.numberOfVisitor),
        numberOfEmployee: Number(data.numberOfEmployee),
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

      // event情報をgraphAPIに渡せるように成型
      const [updateEvent, errors] = await MSGraph.generateEventData(
        data,
        req.session.user.email
      );

      // 入力エラーの場合
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      // 更新分フィールドのみ抽出
      const params = MSGraph.pickDirtyFields(updateEvent, dirtyFields);
      console.log("変更分抽出：", params);

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

      // visitorの更新/作成
      let visitor = null;
      if (visitorId) {
        // visitorが存在する場合はupdate
        visitor = await Visitor.updateOne(visitorId).set(data);
      } else {
        // visitorが存在しない場合はcreate
        visitor = await Visitor.create(data).fetch();
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

      // graphAPIからevent取得
      const events = await MSGraph.getCalendarEvents(
        accessToken,
        req.session.user.email,
        {
          startDateTime: moment(startTimestamp).format(),
          endDateTime: moment(endTimestamp).format(),
          $orderBy: "start/dateTime",
          $select: "start,end,iCalUId,subject,organizer,locations,attendees",
        }
      );

      // ロケーションの取得
      const location = await Location.findOne({ url: req.query.location });

      // event情報を対象ロケーションの会議室予約のみにフィルタリング。
      const targetEvents = await filter(events, async (event) => {
        if (event.locations.length === 0) {
          return false;
        }
        return await some(event.locations, async (eventLocation) => {
          if (!eventLocation.hasOwnProperty("locationUri")) {
            return false;
          }
          const room = await Room.findOne({
            email: eventLocation.locationUri,
            location: location.id,
          });
          return !!room;
        });
      });
      // GraphAPIのevent情報とVisitor情報をマージ
      const result = await map(targetEvents, async (event) => {
        return await sails.helpers.attachVisitorData(
          event,
          req.session.user.email
        );
      });

      return res.json(result.filter((v) => v));
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

      // graphAPIからevent取得
      const events = await MSGraph.getCalendarEvents(
        accessToken,
        req.session.user.email,
        {
          startDateTime: moment(startTimestamp).format(),
          endDateTime: moment(endTimestamp).format(),
          $orderBy: "start/dateTime",
        }
      );
      return res.json({ schedules: schedules, events: events });

      // TODO:画面作成時にどちらが良いかに考えること！！
      // これを使うなら、locations[0]になっているので複数会議室に対応させること
      //
      // 空き時間情報の配列の中に、該当イベントの情報も一緒にセット
      // const targetEvents = schedules.map((schedule) => {
      //   const isSameRoom = (event) => {
      //     if (
      //       event.locations.length === 0 ||
      //       !event.locations[0].hasOwnProperty("locationUri")
      //     ) {
      //       return false;
      //     }
      //     return event.locations[0].locationUri === schedule.scheduleId;
      //   };
      //   return { ...schedule, event: events[events.findIndex(isSameRoom)] };
      // });
      // return res.json(targetEvents);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};

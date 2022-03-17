/**
 * EventController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");
const moment = require("moment-timezone");
const { filter, map } = require("p-iteration");

module.exports = {
  addEvent: async (req, res) => {
    try {
      const errors = {};
      const data = req.body;

      // 会議室の取得
      const room = await Room.findOne(data.room);

      // 日時の設定
      const startTimestamp = new Date(data.startTime).getTime();
      const endTimestamp = new Date(data.endTime).getTime();

      // イベント日時の関係性チェック
      if (startTimestamp >= endTimestamp) {
        const dateErrCode = "visitdialog.form.error.event-time";
        errors.startTime = [dateErrCode];
        errors.endTime = [dateErrCode];
      }
      // 入力エラーの場合
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      // graphAPIにpostするevent情報
      const event = {
        subject: data.subject,
        start: {
          dateTime: MSGraph.getGraphDateTime(startTimestamp),
          timeZone: MSGraph.getTimeZone(),
        },
        end: {
          dateTime: MSGraph.getGraphDateTime(endTimestamp),
          timeZone: MSGraph.getTimeZone(),
        },
        location: {
          displayName: room.name, // outlookのスケジュール表に表示される文字列
          locationType: "conferenceRoom",
          locationEmailAddress: room.email,
        },
        attendees: [
          {
            emailAddress: { address: req.session.user.email },
            type: "required",
          },
          {
            emailAddress: { address: room.email },
            type: "resource", //リソース
          },
        ],
      };

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
        teaSupply: data.teaSupply,
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
        }
      );
      // return res.json(events);

      // event情報を会議室予約（type=rooms/free）のみにフィルタリング。
      const targetEvents = await filter(events, async (event) => {
        if (
          event.locations.length === 0 ||
          !event.locations[0].hasOwnProperty("locationUri")
        ) {
          return false;
        }
        const room = await Room.findOne({
          email: event.locations[0].locationUri,
        });
        return !!room;
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
      //会議室の取得
      const query = req.query.type ? { type: req.query.type } : null;
      const rooms = await Room.find(query).sort("sort ASC");

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

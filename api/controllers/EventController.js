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
      const data = req.body;

      // 会議室の取得
      const room = await Room.findOne(data.room);

      // 日時の設定
      const startTimestamp = new Date(data.startTime).getTime();
      const endTimestamp = new Date(data.endTime).getTime();

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
      if (!$) {
        throw new Error("Microsoftのイベント登録に失敗しました");
      }

      const visitor = await Visitor.create({
        iCalUId: $.iCalUId,
        visitCompany: data.visitCompany,
        visitorName: data.visitorName,
        reservationName: data.reservationName,
        teaSupply: data.teaSupply,
        numberOfVisitor: Number(data.numberOfVisitor),
        numberOfEmployee: Number(data.numberOfEmployee),
        comment: data.comment,
        contactAddr: data.contactAddr,
      }).fetch();

      if (!!visitor) {
        return res.json({ success: true });
      } else {
        return res.json({ success: false });
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
          startDateTime: moment(startTimestamp).format(), // for calendar/calendarView
          endDateTime: moment(endTimestamp).format(), // for calendar/calendarView"
          $orderBy: "start/dateTime",
          $filter: `start/dateTime ge '${MSGraph.getGraphDateTime(
            startTimestamp
          )}' and end/dateTime lt '${MSGraph.getGraphDateTime(endTimestamp)}'`,
          $select: `attendees,start,end,locations,subject,iCalUid`,
        }
      );
      // return res.json(events);

      // 会議室予約（type=rooms/free）のみにフィルタリング。
      const conferences = await filter(events, async (event) => {
        if (
          event.locations.length === 0 ||
          !event.locations[0].hasOwnProperty("locationUri")
        ) {
          return false;
        }
        const room = await Room.findOne({
          email: event.locations[0].locationUri,
        });
        return !!room && room.type === req.query.type;
      });
      // GraphAPIのevent情報とVisitor情報をマージ
      const result = await map(conferences, async (event) => {
        const startTime = MSGraph.getTimeFormat(event.start.dateTime);
        const endTime = MSGraph.getTimeFormat(event.end.dateTime);
        const visitor = await Visitor.findOne({ iCalUId: event.iCalUId });
        if (!!visitor) {
          return {
            eventId: event.id,
            visitorId: visitor.id,
            apptTime: `${startTime}-${endTime}`,
            roomName: event.locations[0].displayName,
            visitCompany: visitor.visitCompany,
            visitorName: visitor.visitorName,
            reservationName: visitor.reservationName,
            teaSupply: visitor.teaSupply,
            numberOfVisitor: visitor.numberOfVisitor,
            numberOfEmployee: visitor.numberOfEmployee,
            comment: visitor.comment,
            contactAddr: visitor.contactAddr,
          };
        }
      });
      return res.json(result.filter((v) => v));
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};

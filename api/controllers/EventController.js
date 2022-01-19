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
      console.log("data --------------", req.body);

      const visitor = await Visitor.create({
        visitCompany: data.visitCompany,
        visitorName: data.visitorName,
        reservationName: data.reservationName,
        teaSupply: data.teaSupply,
        numberOfVisitor: Number(data.numberOfVisitor),
        numberOfEmployee: Number(data.numberOfEmployee),
        comment: data.comment,
        contactAddr: data.contactAddr,
      }).fetch();

      const room = await Room.findOne("61e610295f1b7020ccb2e002");

      // TODO:debug用。日時の設定
      const startTimestamp = new Date("2022-01-27T11:30:00+0900").getTime();
      const endTimestamp = new Date("2022-01-27T12:30:00+0900").getTime();

      // graphAPIにpostするevent情報
      const event = {
        subject: "テスト",
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
        extensions: [
          {
            "@odata.type": "microsoft.graph.openTypeExtension",
            extensionName: MSGraph.extensionName,
            visitorId: visitor.id,
          },
        ],
      };
      console.log("event----------------------", JSON.stringify(event));

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
      console.log("response----------------------", $);

      if (!!$) {
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
          // startDateTime: moment(startTimestamp).format(), // for calendar/calendarView
          // endDateTime: moment(endTimestamp).format(), // for calendar/calendarView"
          $orderBy: "start/dateTime",
          $filter: `start/dateTime ge '${MSGraph.getGraphDateTime(
            startTimestamp
          )}' and end/dateTime lt '${MSGraph.getGraphDateTime(
            endTimestamp
          )}' and Extensions/any(f:f/id eq '${MSGraph.extensionName}')`, // 抽出条件に拡張プロパティがあることを追加
          $expand: `Extensions($filter=id eq '${MSGraph.extensionName}')`, // 拡張プロパティの取得を追加
        }
      );
      // type=rooms/free のフィルタリング
      const conferences = await filter(events, async (event) => {
        const room = await Room.findOne({
          email: event.location.locationUri,
        });
        return !!room && room.type === req.query.type;
      });
      // GraphAPIのevent情報とVisitor情報をマージ
      const result = await map(conferences, async (event) => {
        const startTime = MSGraph.getTimeFormat(event.start.dateTime);
        const endTime = MSGraph.getTimeFormat(event.end.dateTime);
        const visitor = await Visitor.findOne(event.extensions[0].visitorId);
        return {
          eventId: event.id,
          visitorId: event.extensions[0].visitorId,
          apptTime: `${startTime}-${endTime}`,
          roomName: event.location.displayName,
          visitCompany: visitor.visitCompany,
          visitorName: visitor.visitorName,
          reservationName: visitor.reservationName,
          teaSupply: visitor.teaSupply,
          numberOfVisitor: visitor.numberOfVisitor,
          numberOfEmployee: visitor.numberOfEmployee,
          comment: visitor.comment,
          contactAddr: visitor.contactAddr,
        };
      });
      return res.json(result);
    } catch (err) {
      // sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};

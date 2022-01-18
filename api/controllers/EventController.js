/**
 * EventController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");
const moment = require("moment-timezone");
const { filter } = require("p-iteration");

module.exports = {
  addEvent: async (req, res) => {
    try {
      // const data = req.body;
      // console.log("post data --------------", req.body);

      const room = await Room.findOne("61e610295f1b7020ccb2e002");
      if (!room) {
        throw Error("addEvent(): 会議室情報の取得に失敗しました");
      }

      // TODO:debug用。日時の設定
      const startTimestamp = new Date("2022-01-27T11:30:00+0900").getTime();
      const endTimestamp = new Date("2022-01-27T12:30:00+0900").getTime();

      const data = {
        subject: "テスト",
        start: {
          dateTime: MSGraph.getDateTimeFormat(startTimestamp),
          timeZone: MSGraph.getTimeZone(),
        },
        end: {
          dateTime: MSGraph.getDateTimeFormat(endTimestamp),
          timeZone: MSGraph.getTimeZone(),
        },
        location: {
          displayName: room.name, // outlookのスケジュール表に表示される文字列
          locationType: "conferenceRoom",
          locationEmailAddress: room.email,
        },
        attendees: [
          {
            emailAddress: {
              address: req.session.user.email,
            },
            type: "required",
          },
          {
            emailAddress: {
              address: room.email,
            },
            type: "resource", //リソース
          },
        ],
        extensions: [
          {
            "@odata.type": "microsoft.graph.openTypeExtension",
            extensionName: MSGraph.extensionName,
            visitorId: "61e6465648aba91cdcb7f9d5",
          },
        ],
      };
      console.log("data----------------------", JSON.stringify(data));

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );
      // graphAPIからevent登録
      const event = await MSGraph.postEvent(
        accessToken,
        req.session.user.email,
        data
      );
      console.log("response----------------------", event);
      res.json(event);
    } catch (err) {
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
          $filter: `start/dateTime ge '${MSGraph.getDateTimeFormat(
            startTimestamp
          )}' and end/dateTime lt '${MSGraph.getDateTimeFormat(
            endTimestamp
          )}' and Extensions/any(f:f/id eq '${MSGraph.extensionName}')`,
          $expand: `Extensions($filter=id eq '${MSGraph.extensionName}')`,
        }
      );
      // type=rooms/free のフィルタリング
      const conferences = await filter(events, async (event) => {
        const room = await Room.findOne({
          email: event.location.locationUri,
        });
        return !!room && room.type === req.query.type;
      });

      return res.json(conferences);

      // return res.json([
      //   {
      //     apptTime: "10:00-11:30",
      //     roomName: "会議室１",
      //     visitCompany: "ABC会社",
      //     visitorName: "来訪太郎",
      //     reservationName: "自社一郎",
      //     teaSupply: true,
      //     numberOfVisitor: 1,
      //     numberOfEmployee: 2,
      //     comment: "ホットコーヒーお願いします。",
      //     contactAddr: "内線123",
      //   },
      //   {
      //     apptTime: "10:30-11:30",
      //     roomName: "会議室２",
      //     visitCompany: "ZYX会社",
      //     visitorName: "山田花子",
      //     teaSupply: false,
      //     numberOfVisitor: 2,
      //     numberOfEmployee: 1,
      //     comment: "",
      //     reservationName: "田中次郎",
      //     contactAddr: "内線777",
      //   },
      //   {
      //     apptTime: "13:00-14:00",
      //     roomName: "会議室１",
      //     visitCompany: "ABC会社",
      //     visitorName: "来訪太郎",
      //     teaSupply: true,
      //     numberOfVisitor: 2,
      //     numberOfEmployee: 2,
      //     comment: "",
      //     reservationName: "自社一郎",
      //     contactAddr: "内線123",
      //   },
      //   {
      //     apptTime: "13:00-14:00",
      //     roomName: "会議室○",
      //     visitCompany: "○○会社",
      //     visitorName: "○田○郎",
      //     teaSupply: false,
      //     numberOfVisitor: 2,
      //     numberOfEmployee: 2,
      //     comment: "",
      //     reservationName: "○山○子",
      //     contactAddr: "内線○○○",
      //   },
      //   {
      //     apptTime: "13:00-14:00",
      //     roomName: "会議室○",
      //     visitCompany: "○○会社",
      //     visitorName: "○田○郎",
      //     teaSupply: false,
      //     numberOfVisitor: 2,
      //     numberOfEmployee: 2,
      //     comment: "",
      //     reservationName: "○山○子",
      //     contactAddr: "内線○○○",
      //   },
      //   {
      //     apptTime: "13:00-14:00",
      //     roomName: "会議室○",
      //     visitCompany: "○○会社",
      //     visitorName: "○田○郎",
      //     teaSupply: false,
      //     numberOfVisitor: 2,
      //     numberOfEmployee: 2,
      //     comment: "",
      //     reservationName: "○山○子",
      //     contactAddr: "内線○○○",
      //   },
      //   {
      //     apptTime: "13:00-14:00",
      //     roomName: "会議室○",
      //     visitCompany: "○○会社",
      //     visitorName: "○田○郎",
      //     teaSupply: false,
      //     numberOfVisitor: 2,
      //     numberOfEmployee: 2,
      //     comment: "",
      //     reservationName: "○山○子",
      //     contactAddr: "内線○○○",
      //   },
      // ]);
    } catch (err) {
      return res.status(400).json({ body: err.message });
    }
  },
};

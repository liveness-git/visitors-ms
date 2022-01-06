/**
 * EventController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSGraph = require("../services/MSGraph");
const moment = require("moment-timezone");

module.exports = {
  visitList: async (req, res) => {
    try {
      const timestamp = Number(req.query.timestamp);
      // graphAPIからevent取得
      const events = await MSGraph.getCalendarEvents(
        req.session.user.accessToken,
        req.session.user.email,
        {
          startDateTime: moment(timestamp).startOf("date").add(1, "s").format(),
          endDateTime: moment(timestamp)
            .endOf("date")
            .add(1, "months")
            .format(),
          orderBy: "start/dateTime",
        }
      );
      //TODO: type=rooms/free のparam追加すること！！
      const conferences = events.filter((event) => event.locations.length > 0);

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
      //     checkIn: "yyyy/mm/dd hh:mm:ss",
      //     checkOut: "yyyy/mm/dd hh:mm:ss",
      //     visitorCardNumber: "test1",
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
      //     checkIn: "yyyy/mm/dd hh:mm:ss",
      //     checkOut: "",
      //     visitorCardNumber: "test2",
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
      //     checkIn: "",
      //     checkOut: "",
      //     visitorCardNumber: "",
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
      //     checkIn: "",
      //     checkOut: "",
      //     visitorCardNumber: "",
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
      //     checkIn: "",
      //     checkOut: "",
      //     visitorCardNumber: "",
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
      //     checkIn: "",
      //     checkOut: "",
      //     visitorCardNumber: "",
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
      //     checkIn: "",
      //     checkOut: "",
      //     visitorCardNumber: "",
      //   },
      // ]);
    } catch (err) {
      return res.status(400).json({ body: err.message });
    }
  },
};

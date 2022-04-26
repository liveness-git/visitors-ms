/**
 * RoomController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");

module.exports = {
  list: async (req, res) => {
    try {
      return res.json("ok");
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },
  choices: async (req, res) => {
    try {
      // 予約の開始/終了指定は必須。指定がない場合は[]を返す。
      if (!req.query.start || !req.query.end) {
        return res.json([]);
      }

      const location = await Location.findOne({ url: req.query.location });
      const rooms = await Room.find({ location: location.id }).sort("sort ASC");

      // 空き時間検索せずに全て返す。
      // TODO: 更新時の編集画面で、該当会議室が消えてしまうのを避ける応急処置
      if (req.query.all) {
        return res.json(rooms);
      }

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

      // graphAPIから稼働情報を取得
      const schedules = await MSGraph.getSchedule(
        accessToken,
        req.session.user.email,
        {
          startTime: {
            dateTime: MSGraph.getGraphDateTime(Number(req.query.start) + 1000), // 同時刻終了の予定があった場合、予約可能対象外になるので1ms進めて検索
            timeZone: MSGraph.getTimeZone(),
          },
          endTime: {
            dateTime: MSGraph.getGraphDateTime(Number(req.query.end)),
            timeZone: MSGraph.getTimeZone(),
          },
          schedules: rooms.map((room) => room.email),
          availabilityViewInterval: "5", //TODO: Interval config化？
        }
      );
      const result = rooms.filter((room) => {
        const schedule = schedules.filter((r) => r.scheduleId === room.email);
        return schedule[0].scheduleItems.length === 0;
      });

      return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },
};

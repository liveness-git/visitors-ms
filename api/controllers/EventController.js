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

      // 空き時間チェック
      const [isAvailable, errAvailable] = await MSGraph.isAvailableRooms(
        accessToken,
        req.session.user.email,
        event
      );
      if (!isAvailable) {
        return res.json({ success: false, errors: errAvailable });
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

      // 空き時間チェック(予約時間が変更されている場合のみ)
      if (!!dirtyFields.startTime || !!dirtyFields.endTime) {
        // 変更前情報
        const beforeStart = MSGraph.getTimestamp($.start.dateTime);
        const beforeEnd = MSGraph.getTimestamp($.end.dateTime);
        // 変更後情報
        const afterStart = new Date(updateEvent.start.dateTime).getTime();
        const afterEnd = new Date(updateEvent.end.dateTime).getTime();

        // 変更前後で時間の重複がある場合
        if (beforeStart < afterEnd && beforeEnd > afterStart) {
          // 開始時刻が繰り上がっている場合
          if (beforeStart > afterStart) {
            // 開始時刻の差分をチェック
            const [isAvailable1, errAvailable1] =
              await MSGraph.isAvailableRooms(
                accessToken,
                req.session.user.email,
                updateEvent,
                afterStart,
                beforeStart
              );
            if (!isAvailable1) {
              return res.json({ success: false, errors: errAvailable1 });
            }
          }
          // 終了時刻が延長している場合
          if (beforeEnd < afterEnd) {
            // 終了時刻の差分をチェック
            const [isAvailable2, errAvailable2] =
              await MSGraph.isAvailableRooms(
                accessToken,
                req.session.user.email,
                updateEvent,
                beforeEnd,
                afterEnd
              );
            if (!isAvailable2) {
              return res.json({ success: false, errors: errAvailable2 });
            }
          }
        } else {
          // 通常の空き時間チェック
          const [isAvailable, errAvailable] = await MSGraph.isAvailableRooms(
            accessToken,
            req.session.user.email,
            updateEvent
          );
          if (!isAvailable) {
            return res.json({ success: false, errors: errAvailable });
          }
        }
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

      // 会議室の取得
      const rooms = await Room.find({
        location: location.id,
        type: req.query.type,
      }).sort("sort ASC");

      // 該当会議室がない場合(roomのtype指定があるので可能性あり)
      if (rooms.length === 0) {
        return res.json({ schedules: [], events: [] });
      }

      // 取得期間の設定
      const timestamp = Number(req.query.timestamp);
      const startTimestamp = moment(timestamp).startOf("date");
      const endTimestamp = moment(timestamp).endOf("date");

      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

      // graphAPIから各会議室の利用情報を取得
      const $schedules = await MSGraph.getSchedule(
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
          $select: "scheduleId,scheduleItems",
        }
      );

      // graphAPIからevent取得し対象ロケーションの会議室予約のみにフィルタリング。
      const $events = await sails.helpers.getTargetFromEvents(
        accessToken,
        req.session.user.email,
        startTimestamp,
        endTimestamp,
        req.query.location,
        req.query.type
      );

      // GraphAPIのevent情報とVisitor情報をマージ
      const events = await map($events, async (event) => {
        return await sails.helpers.attachVisitorData(
          event,
          req.session.user.email
        );
      });

      // 各会議室の利用情報を再構成
      const schedules = $schedules.map((schedule) => {
        const room = rooms.find((room) => room.email === schedule.scheduleId);
        return {
          roomId: room.id,
          roomName: room.name,
          roomEmail: room.email,
          scheduleItems: schedule.scheduleItems.map((item) => {
            return {
              status: item.status,
              start: MSGraph.getTimestamp(item.start.dateTime),
              end: MSGraph.getTimestamp(item.end.dateTime),
            };
          }),
          // 該当会議室のイベント配列Indexを保持する
          eventsIndex: events.reduce((result, event, index) => {
            if (
              Object.keys(event.resourcies).some(
                (key) =>
                  event.resourcies[key].roomEmail === schedule.scheduleId &&
                  event.resourcies[key].roomStatus === "accepted"
              )
            ) {
              result.push(index);
            }
            return result;
          }, []),
        };
      });

      return res.json({ schedules: schedules, events: events });
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};

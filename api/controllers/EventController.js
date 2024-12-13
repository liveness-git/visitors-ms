/**
 * EventController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");
const MSCache = require("../services/MSCache");
const moment = require("moment-timezone");
const { map } = require("p-iteration");

const isOwnerMode = sails.config.visitors.isOwnerMode;
const ownerEmail = sails.config.visitors.credential.username;
const isCreatedOnly = sails.config.visitors.isCreatedOnly;

module.exports = {
  create: async (req, res) => {
    try {
      const data = req.body.inputs;

      // event情報をgraphAPIに渡せるように成型
      const [event, errors] = await MSGraph.generateEventData(data, {
        name: req.session.user.name,
        email: req.session.user.email,
        isAdmin: req.session.user.isAdmin,
      });

      // 入力エラーの場合
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      // msalから有効なaccessToken取得
      // msalから有効なaccessToken取得(代表)
      const [accessToken, ownerToken] = await Promise.all([
        MSAuth.acquireToken(req.session.user.localAccountId),
        MSAuth.acquireToken(req.session.owner.localAccountId),
      ]);

      // 空き時間チェック
      if (!data.recurrence) {
        const [isAvailable, errAvailable] = await MSGraph.isAvailableRooms(
          accessToken,
          req.session.user.email,
          event
        );
        if (!isAvailable) {
          return res.json({ success: false, errors: errAvailable });
        }
      }

      // graphAPIからevent登録
      let $;
      try {
        $ = await MSGraph.postEvent(
          isOwnerMode ? ownerToken : accessToken,
          isOwnerMode ? ownerEmail : req.session.user.email,
          event
        );
      } catch (e) {
        // 指定された繰り返しに指定された範囲に出現インスタンスが存在しない場合
        if (e.response.data.error.code === "ErrorRecurrenceHasNoOccurrence") {
          return res.json({
            success: false,
            errors: {
              recurrence: [
                "visitdialog.form.error.recurrence.has-no-occurrence",
              ],
            },
          });
        }
      }

      // visitor作成
      const newData = {
        usageRange: data.usageRange,
        visitCompany: data.visitCompany,
        numberOfVisitor: Number(data.numberOfVisitor),
        numberOfEmployee: Number(data.numberOfEmployee),
        resourcies: await sails.helpers.generateVisitorResourcies(
          data.resourcies
        ),
        comment: data.comment,
        contactAddr: data.contactAddr,
        reservationInfo: {
          officeLocation: req.session.user.entity.officeLocation,
          department: req.session.user.entity.department,
        },
      };

      // visitor登録
      const visitor = await Visitor.create({
        ...newData,
        iCalUId: $.iCalUId,
        eventType: $.type,
      }).fetch();

      const visitors = [visitor];

      // 定期イベントの場合、複数作成
      if (!!$.recurrence) {
        const [$visitors, instances] =
          await sails.helpers.createVisitorInstances(
            isOwnerMode ? ownerToken : accessToken,
            isOwnerMode ? ownerEmail : req.session.user.email,
            $.id,
            { ...newData, seriesMasterICalUId: $.iCalUId }
          );
        visitors.concat($visitors);
        await MSCache.reflectEventForRecurrence($.id, instances); // キャッシュに反映
      }

      if (visitors.every((visitor) => !!visitor)) {
        return res.json({ success: true });
      } else {
        throw new Error("The registration process failed.");
      }
    } catch (err) {
      sails.log.error("EventController.create(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },

  update: async (req, res) => {
    try {
      const dirtyFields = req.body.dirtyFields;
      const data = req.body.inputs;
      const visitorId = data.visitorId;

      // event情報をgraphAPIに渡せるように成型
      const [updateEvent, errors] = await MSGraph.generateEventData(data, {
        name: data.mailto.authors[0].name,
        email: data.mailto.authors[0].address,
        isAdmin: req.session.user.isAdmin,
      });

      // 入力エラーの場合
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      // 更新分フィールドのみ抽出
      const params = MSGraph.pickDirtyFields(updateEvent, dirtyFields);
      // sails.log.debug("変更分抽出：", params);// TODO: debug

      // msalから有効なaccessToken取得
      // msalから有効なaccessToken取得(代表)
      const [accessToken, ownerToken] = await Promise.all([
        MSAuth.acquireToken(req.session.user.localAccountId),
        MSAuth.acquireToken(req.session.owner.localAccountId),
      ]);

      // iCalUIdからevent取得
      let $ = null;
      if (!!data.seriesMasterId) {
        // ** 定期イベント(今回のみ)の場合
        $ = (
          await MSGraph.getEventsBySeriesMasterId(
            isOwnerMode ? ownerToken : accessToken,
            isOwnerMode ? ownerEmail : req.session.user.email,
            data.seriesMasterId,
            data.iCalUId
          )
        )[0];
      } else {
        // ** 通常・定期イベント(全体)の場合
        $ = await MSGraph.getEventByIcaluid(
          isOwnerMode ? ownerToken : accessToken,
          isOwnerMode ? ownerEmail : req.session.user.email,
          data.iCalUId
        );
      }
      if (!$) {
        throw new Error("Could not obtain MSGraph Event to update.");
      }

      // 空き時間チェック(予約時間が変更されている場合のみ)
      if (
        !data.recurrence &&
        (!!dirtyFields.startTime || !!dirtyFields.endTime)
      ) {
        // 変更前情報
        const beforeStart = MSGraph.getTimestamp($.start.dateTime);
        const beforeEnd = MSGraph.getTimestamp($.end.dateTime);
        // 変更後情報
        const afterStart = new Date(updateEvent.start.dateTime).getTime();
        const afterEnd = new Date(updateEvent.end.dateTime).getTime();

        // 会議室ごとのオブジェクトに再加工
        const locations = await MSGraph.reduceLocations($);
        const first = Object.keys(locations)[0]; // TODO:複数会議室未対応

        // 変更前後で時間の重複がある場合
        if (
          beforeStart < afterEnd &&
          beforeEnd > afterStart &&
          locations[first].status !== "declined" // 辞退の場合は対象外
        ) {
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
      // ※定期イベントの場合、patch内容が無くても更新したら(type:occurrence → exception)に変更される。
      // visitor情報の更新だけでもexceptionになる必要がある為、GraphAPI側に変更内容が無くても更新する。
      let event;
      try {
        event = await MSGraph.patchEvent(
          isOwnerMode ? ownerToken : accessToken,
          isOwnerMode ? ownerEmail : req.session.user.email,
          $.id,
          params
        );
        if (!event) {
          throw new Error("Failed to update MSGraph Event data.");
        }
      } catch (e) {
        // 指定された繰り返しに指定された範囲に出現インスタンスが存在しない場合
        if (e.response.data.error.code === "ErrorRecurrenceHasNoOccurrence") {
          return res.json({
            success: false,
            errors: {
              recurrence: [
                "visitdialog.form.error.recurrence.has-no-occurrence",
              ],
            },
          });
        }
        throw e;
      }

      // リソース情報だけ再加工
      const resourcies = await sails.helpers.generateVisitorResourcies(
        data.resourcies
      );
      const newData = {
        ...data,
        numberOfVisitor: Number(data.numberOfVisitor),
        numberOfEmployee: Number(data.numberOfEmployee),
        resourcies: resourcies,
        eventType: event.type, // 変更される可能性がある為、最新を上書き。
      };

      // visitorの更新/作成
      let visitor = null;
      if (visitorId) {
        // visitorが存在する場合はupdate
        visitor = await Visitor.updateOne(visitorId).set({ ...newData });
      } else {
        // visitorが存在しない場合はcreate
        visitor = await Visitor.create({ ...newData }).fetch();
      }

      const visitors = [visitor];

      // 定期イベント(全体)の場合
      if (!!data.recurrence) {
        let isRecreate = false;

        // newDataはseriesMasterの情報なので一部削除
        const newDataInstances = _.cloneDeep(newData);
        delete newDataInstances.iCalUId;
        delete newDataInstances.eventType;

        if (!!dirtyFields.recurrence) {
          // recurrenceが変更されている場合
          // seriesMasterに紐付くvisitorを全削除
          const oldVisitors = await Visitor.destroy({
            seriesMasterICalUId: event.iCalUId,
          }).fetch();
          if (!oldVisitors) {
            throw new Error("Failed to delete Visitors data.");
          }
          isRecreate = true; // 再登録
        } else {
          // recurrence以外のマスタ変更は、type:occurrenceのみを一括更新
          // visitorが存在する場合はupdate
          const occurrence = await Visitor.update({
            seriesMasterICalUId: event.iCalUId,
            eventType: "occurrence", // type:occurrenceのみ
          })
            .set({ ...newDataInstances })
            .fetch();

          // visitorが存在しない場合はcreate
          if (!occurrence) {
            isRecreate = true;
          }
          visitors.concat(occurrence);
        }

        let $visitors = [];
        let instances = [];

        if (isRecreate) {
          // インスタンス登録
          [$visitors, instances] = await sails.helpers.createVisitorInstances(
            isOwnerMode ? ownerToken : accessToken,
            isOwnerMode ? ownerEmail : req.session.user.email,
            $.id,
            { ...newDataInstances, seriesMasterICalUId: $.iCalUId }
          );
          visitors.concat($visitors);
        } else {
          // インスタンス取得
          instances = await MSGraph.getEventsBySeriesMasterId(
            isOwnerMode ? ownerToken : accessToken,
            isOwnerMode ? ownerEmail : req.session.user.email,
            $.id
          );
        }
        await MSCache.reflectEventForRecurrence($.id, instances); // キャッシュに反映
      }

      // 定期イベントの解除
      if (params.recurrence === null) {
        // seriesMasterに紐付くvisitorを全削除
        const instances = await Visitor.destroy({
          seriesMasterICalUId: event.iCalUId,
        }).fetch();
        if (!instances) {
          throw new Error("Failed to delete Visitors data.");
        }
      }

      if (!visitors.every((visitor) => !!visitor)) {
        throw new Error("Failed to update Visitor data.");
      }

      return res.json({ success: true });
    } catch (err) {
      sails.log.error("EventController.update(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },

  delete: async (req, res) => {
    try {
      const data = req.body.inputs;
      const visitorId = data.visitorId;

      // msalから有効なaccessToken取得
      // msalから有効なaccessToken取得(代表)
      const [accessToken, ownerToken] = await Promise.all([
        MSAuth.acquireToken(req.session.user.localAccountId),
        MSAuth.acquireToken(req.session.owner.localAccountId),
      ]);

      // iCalUIdからevent取得
      let $ = null;
      if (!!data.seriesMasterId) {
        // ** 定期イベント(今回のみ)の場合
        $ = (
          await MSGraph.getEventsBySeriesMasterId(
            isOwnerMode ? ownerToken : accessToken,
            isOwnerMode ? ownerEmail : req.session.user.email,
            data.seriesMasterId,
            data.iCalUId
          )
        )[0];
      } else {
        // ** 通常・定期イベント(全体)の場合
        $ = await MSGraph.getEventByIcaluid(
          isOwnerMode ? ownerToken : accessToken,
          isOwnerMode ? ownerEmail : req.session.user.email,
          data.iCalUId
        );
      }
      if (!$) {
        throw new Error("Could not obtain MSGraph Event to delete.");
      }

      // eventの削除
      const event = MSGraph.deleteEvent(
        isOwnerMode ? ownerToken : accessToken,
        isOwnerMode ? ownerEmail : req.session.user.email,
        $.id,
        !!data.recurrence
          ? { seriesMasterId: $.id } // 定期イベント(全体)のキャッシュ削除条件
          : { iCalUId: $.iCalUId } // 通常・定期イベント(今回のみ)のキャッシュ削除条件
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

      // 定期イベント(全体)の場合
      if (!!data.recurrence) {
        // seriesMasterに紐付くvisitorを全削除
        const oldVisitors = await Visitor.destroy({
          seriesMasterICalUId: data.iCalUId,
        }).fetch();
        if (!oldVisitors) {
          throw new Error("Failed to delete Visitors data.");
        }
      }

      return res.json({ success: true });
    } catch (err) {
      sails.log.error("EventController.delete(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },

  visitInfo: async (req, res) => {
    try {
      // msalから有効なaccessToken取得
      // msalから有効なaccessToken取得(代表)
      const [accessToken, ownerToken] = await Promise.all([
        MSAuth.acquireToken(req.session.user.localAccountId),
        MSAuth.acquireToken(req.session.owner.localAccountId),
      ]);

      // memo: 個人アクセストークンで取得可能だが、共有アカウントだとlocation情報を取得するために変更が必要なため
      //       定期的な予定全体は１件取得だけ、かつトリガーイベントも常に発生ではないので、ひとまず代表アカウントに戻しています
      // graphAPIからevent取得
      const event = await MSGraph.getEventById(
        isOwnerMode ? ownerToken : accessToken,
        isOwnerMode ? ownerEmail : req.session.user.email,
        req.param("id")
      );

      // GraphAPIのevent情報とVisitor情報をマージ
      const result = await sails.helpers.attachVisitorData(
        event,
        req.session.user.email,
        false
      );

      return res.json(result);
    } catch (err) {
      sails.log.error("EventController.visitInfo(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },

  checkInstances: async (req, res) => {
    try {
      const iCalUId = req.param("iCalUId");

      // 定期イベント内にtype:exceptionが存在するか
      const result = await Visitor.find({
        seriesMasterICalUId: iCalUId,
        eventType: "exception", // type:exceptionのみ
      });
      return res.json({ isIncludesException: result.length > 0 });
    } catch (err) {
      sails.log.error("EventController.checkInstances(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },

  visitList: async (req, res) => {
    try {
      // 取得期間の設定
      const timestamp = Number(req.query.timestamp);
      const startTimestamp = moment(timestamp).startOf("date");
      const endTimestamp = moment(timestamp).endOf("date").add(1, "months");

      // msalから有効なaccessToken取得
      // msalから有効なaccessToken取得(代表)
      const [accessToken, ownerToken, shareToken] = await Promise.all([
        MSAuth.acquireToken(req.session.user.localAccountId),
        MSAuth.acquireToken(req.session.owner.localAccountId),
        MSAuth.acquireToken(
          req.session.share.filter(
            (account) => account.location === req.query.location
          )[0].localAccountId
        ),
      ]);

      const location = await Location.findOne({ url: req.query.location });

      // categories絞り込み用のラベル選択
      const label = isCreatedOnly
        ? MSGraph.getAuthorLabel(req.session.user.email)
        : MSGraph.getLocationLabel(location.id);

      // キャッシュ抽出条件
      const cacheCriteria = isCreatedOnly
        ? { author: req.session.user.email }
        : {};

      // graphAPIからevent取得し対象ロケーションの会議室予約のみにフィルタリング。
      const $events = await sails.helpers.getTargetFromEvents(
        isOwnerMode ? label : "",
        false ? ownerToken : shareToken, //accessToken
        isOwnerMode ? ownerEmail : req.session.user.email,
        startTimestamp,
        endTimestamp,
        req.query.location,
        cacheCriteria
      );

      let events = $events;
      if (isOwnerMode && !isCreatedOnly) {
        // ログインユーザーと関係のある予約を抽出
        events = $events.filter((event) =>
          event.attendees.some(
            (user) =>
              user.emailAddress.address.toLowerCase() ===
              req.session.user.email.toLowerCase()
          )
        );
      }

      // GraphAPIのevent情報とVisitor情報をマージ
      const result = (
        await map(events, async (event) => {
          return await sails.helpers.attachVisitorData(
            event,
            req.session.user.email,
            false
          );
        })
      ).filter((v) => v);

      // 定期的な予定が含まれる場合、ソートが崩れる為もう一度並び換える。
      result.sort((a, b) => a.startDateTime - b.startDateTime);

      return res.json(result);
    } catch (err) {
      sails.log.error("EventController.visitList(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },

  byRoom: async (req, res) => {
    try {
      // ロケーションの取得
      const location = await Location.findOne({ url: req.query.location });

      // 会議室の取得
      const rooms = await Room.find({
        location: location.id,
        category: req.query.category,
        // type: "rooms", // フリースペースは表示対象外
      }).sort("sort ASC");

      // 該当会議室がない場合
      if (rooms.length === 0) {
        return res.json({ schedules: [], events: [], lrooms: [] });
      }

      // 取得期間の設定
      const timestamp = Number(req.query.timestamp);
      const startTimestamp = moment(timestamp).startOf("date");
      const endTimestamp = moment(timestamp).endOf("date");

      // msalから有効なaccessToken取得
      // msalから有効なaccessToken取得(代表)
      const [accessToken, ownerToken, shareToken] = await Promise.all([
        MSAuth.acquireToken(req.session.user.localAccountId),
        MSAuth.acquireToken(req.session.owner.localAccountId),
        MSAuth.acquireToken(
          req.session.share.filter(
            (account) => account.location === req.query.location
          )[0].localAccountId
        ),
      ]);

      const [$schedules, events, lrooms] = await Promise.all([
        // graphAPIから各会議室の利用情報を取得
        MSGraph.getSchedule(accessToken, req.session.user.email, {
          // await MSGraph.getSchedule(accessToken, req.session.user.email, {// 調整 *** 並列 ← await追加して直列に変更
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
        }),
        (async () => {
          // await (async () => {// 調整 *** 並列 ← await追加して直列に変更

          // キャッシュ抽出条件
          const cacheCriteria = {
            category: req.query.category,
          };

          // graphAPIからevent取得し対象ロケーションの会議室予約のみにフィルタリング。
          const $events = await sails.helpers.getTargetFromEvents(
            isOwnerMode ? MSGraph.getCategoryLabel(req.query.category) : "",
            false ? ownerToken : shareToken, //accessToken
            isOwnerMode ? ownerEmail : req.session.user.email,
            startTimestamp,
            endTimestamp,
            req.query.location,
            cacheCriteria
          );

          // GraphAPIのevent情報とVisitor情報をマージ
          return (
            await map($events, async (event) => {
              return await sails.helpers.attachVisitorData(
                event,
                req.session.user.email,
                req.session.user.isFront || req.session.user.isAdmin
              );
            })
          ).filter((v) => v);
        })(),
        (async () => {
          // await (async () => {// 調整 *** 並列 ← await追加して直列に変更

          // GraphAPI負荷を減らすため、一般は非対応
          if (!(req.session.user.isFront || req.session.user.isAdmin)) {
            return [];
          }

          // LivenessRoomsを表示する会議室のみが対象
          const roomEmails = rooms
            .filter((room) => room.displayLivenessRooms)
            .map((room) => room.email);
          if (roomEmails.length === 0) {
            return [];
          }

          // LivenessRoomsで登録されたeventを取得
          return sails.helpers.getLroomsEvents(
            [
              shareToken,
              ownerEmail,
              startTimestamp,
              endTimestamp,
              req.query.location,
            ],
            roomEmails
          );
        })(),
      ]);

      const eventsDummy = _.cloneDeep(events); // イベント配列Index作成用にコピー
      const lroomsDummy = _.cloneDeep(lrooms); // LivenessRooms配列Index作成用にコピー

      // 各会議室の利用情報を再構成
      const schedules = await map($schedules, async (schedule) => {
        // 該当会議室の取得
        const room = rooms.find((room) => room.email === schedule.scheduleId);
        // scheduleItemsの再成型
        const scheduleItems = await sails.helpers.getTimebarScheduleItems(
          schedule.scheduleItems
        );

        // 該当会議室のイベント配列Indexを保持する
        const eventsIndex = scheduleItems.map((row) => {
          return row
            .map((item) => {
              const index = eventsDummy.findIndex(
                (event) =>
                  event &&
                  Object.keys(event.resourcies).some(
                    (key) =>
                      item.start === event.startDateTime &&
                      item.end === event.endDateTime + event.cleaningTime &&
                      event.resourcies[key].roomEmail === schedule.scheduleId &&
                      // // 代表アカウントの場合、会議室status= 承諾のみ。一般アカウントの場合、辞退以外
                      // ((isOwnerMode &&
                      //   event.resourcies[key].roomStatus === "accepted") ||
                      //   (!isOwnerMode &&
                      //     event.resourcies[key].roomStatus !== "declined"))
                      // キャッシュ化に伴い、無条件に辞退以外は表示
                      event.resourcies[key].roomStatus !== "declined"
                  )
              );
              delete eventsDummy[index]; // 次回検索対象から外す
              return index;
            })
            .filter((v) => v > -1);
        });

        // 該当会議室のLivenessRooms配列Indexを保持する
        const lroomsIndex = scheduleItems.map((row) => {
          return row
            .map((item) => {
              const index = lroomsDummy.findIndex(
                (event) =>
                  event &&
                  event.roomEmail === schedule.scheduleId &&
                  item.start === event.startDateTime &&
                  item.end === event.endDateTime
              );
              delete lroomsDummy[index]; // 次回検索対象から外す
              return index;
            })
            .filter((v) => v > -1);
        });

        return {
          date: startTimestamp.valueOf(),
          categoryId: room.category,
          roomId: room.id,
          roomName: room.name,
          roomEmail: room.email,
          type: room.type,
          usageRange: room.usageRange === "none" ? "outside" : room.usageRange,
          scheduleItems: scheduleItems,
          eventsIndex: eventsIndex,
          lroomsIndex: lroomsIndex,
        };
      });

      return res.json({ schedules: schedules, events: events, lrooms: lrooms });
    } catch (err) {
      sails.log.error("EventController.byRoom(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },

  byRoomWeekly: async (req, res) => {
    try {
      // 会議室の取得
      const room = await Room.findOne(req.query.room);

      // 取得期間の設定
      const timestamp = Number(req.query.timestamp);
      const startTimestamp = moment(timestamp).startOf("date");
      const endTimestamp = moment(timestamp).add(7, "days").endOf("date");

      // msalから有効なaccessToken取得
      // msalから有効なaccessToken取得(代表)
      const [accessToken, ownerToken, shareToken] = await Promise.all([
        MSAuth.acquireToken(req.session.user.localAccountId),
        MSAuth.acquireToken(req.session.owner.localAccountId),
        MSAuth.acquireToken(
          req.session.share.filter(
            (account) => account.location === req.query.location
          )[0].localAccountId
        ),
      ]);

      const [$schedules, events, lrooms] = await Promise.all([
        // graphAPIから会議室の利用情報を取得
        MSGraph.getSchedule(accessToken, req.session.user.email, {
          // await MSGraph.getSchedule(accessToken, req.session.user.email, {// 調整 *** 並列 ← await追加して直列に変更
          startTime: {
            dateTime: MSGraph.getGraphDateTime(startTimestamp),
            timeZone: MSGraph.getTimeZone(),
          },
          endTime: {
            dateTime: MSGraph.getGraphDateTime(endTimestamp),
            timeZone: MSGraph.getTimeZone(),
          },
          schedules: [room.email],
          $select: "scheduleId,scheduleItems",
        }),
        (async () => {
          // await (async () => {// 調整 *** 並列 ← await追加して直列に変更

          // キャッシュ抽出条件
          const cacheCriteria = { room: req.query.room };

          // graphAPIからevent取得し対象会議室予約のみにフィルタリング。
          const $events = await sails.helpers.getTargetFromEvents(
            isOwnerMode ? MSGraph.getRoomLabel(req.query.room) : "",
            false ? ownerToken : shareToken, //accessToken
            isOwnerMode ? ownerEmail : req.session.user.email,
            startTimestamp,
            endTimestamp,
            req.query.location,
            cacheCriteria
          );

          // GraphAPIのevent情報とVisitor情報をマージ
          return (
            await map($events, async (event) => {
              return await sails.helpers.attachVisitorData(
                event,
                req.session.user.email,
                req.session.user.isFront || req.session.user.isAdmin
              );
            })
          ).filter((v) => v);
        })(),
        (async () => {
          // await (async () => {// 調整 *** 並列 ← await追加して直列に変更

          // GraphAPI負荷を減らすため、一般は非対応
          if (!(req.session.user.isFront || req.session.user.isAdmin)) {
            return [];
          }
          // LivenessRoomsを表示する会議室のみが対象
          if (!room.displayLivenessRooms) {
            return [];
          }

          // LivenessRoomsで登録されたeventを取得
          return sails.helpers.getLroomsEvents(
            [
              shareToken,
              ownerEmail,
              startTimestamp,
              endTimestamp,
              req.query.location,
            ],
            [room.email]
          );
        })(),
      ]);

      const eventsDummy = _.cloneDeep(events); // イベント配列Index作成用にコピー
      const lroomsDummy = _.cloneDeep(lrooms); // LivenessRooms配列Index作成用にコピー

      // 1週間分の日付配列と該当スケジュールの割り当て
      const weekly = _.range(0, 7).map(($) => {
        const timestamp = startTimestamp.valueOf() + 24 * 60 * 60 * 1000 * $;
        return {
          timestamp: timestamp,
          scheduleItems: $schedules[0].scheduleItems.filter((item) =>
            moment(MSGraph.getTimestamp(item.start.dateTime)).isSame(
              moment(timestamp),
              "day"
            )
          ),
        };
      });

      // 利用情報を再構成
      const schedules = await map(weekly, async (date) => {
        // scheduleItemsの再成型
        const scheduleItems = await sails.helpers.getTimebarScheduleItems(
          date.scheduleItems
        );
        // 該当日のイベント配列Indexを保持する
        const eventsIndex = scheduleItems.map((row) => {
          return row
            .map((item) => {
              const index = eventsDummy.findIndex(
                (event) =>
                  event &&
                  item.start === event.startDateTime &&
                  item.end === event.endDateTime + event.cleaningTime &&
                  // // 代表アカウントの場合、会議室status= 承諾のみ。一般アカウントの場合、辞退以外
                  // ((isOwnerMode &&
                  //   event.resourcies[room.id].roomStatus === "accepted") ||
                  //   (!isOwnerMode &&
                  //     event.resourcies[room.id].roomStatus !== "declined"))
                  // キャッシュ化に伴い、無条件に辞退以外は表示
                  event.resourcies[room.id].roomStatus !== "declined"
              );
              delete eventsDummy[index]; // 次回検索対象から外す
              return index;
            })
            .filter((v) => v > -1);
        });
        // 該当日のLivenessRooms配列Indexを保持する
        const lroomsIndex = scheduleItems.map((row) => {
          return row
            .map((item) => {
              const index = lroomsDummy.findIndex(
                (event) =>
                  event &&
                  item.start === event.startDateTime &&
                  item.end === event.endDateTime
              );
              delete lroomsDummy[index]; // 次回検索対象から外す
              return index;
            })
            .filter((v) => v > -1);
        });

        return {
          date: date.timestamp,
          categoryId: room.category,
          roomId: room.id,
          roomName: room.name,
          roomEmail: room.email,
          type: room.type,
          usageRange: room.usageRange === "none" ? "outside" : room.usageRange,
          scheduleItems: scheduleItems,
          eventsIndex: eventsIndex,
          lroomsIndex: lroomsIndex,
        };
      });

      return res.json({ schedules: schedules, events: events, lrooms: lrooms });
    } catch (err) {
      sails.log.error("EventController.byRoomWeekly(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },
};

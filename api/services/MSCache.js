const moment = require("moment-timezone");
const { forEach } = require("p-iteration");

module.exports = {
  //Eventキャッシュが現在保持している範囲
  rangeRetDateForEvent: async () => {
    const logs = await CacheLog.find({
      where: { type: "event", mode: "reset" },
      sort: "createdAt DESC",
      limit: 1,
    });
    // キャッシュがない場合はnullを返す
    if (logs.length === 0) {
      return [null, null];
    }

    return [logs[0].start, logs[0].end];
  },

  //指定範囲の場合、GraphAPIへのリクエストが必要かチェックする
  checkRequestLiveEvent: async (startTimestamp, endTimestamp) => {
    let flag = false;
    let startDiff;
    let endDiff;

    const [minRetDate, maxRetDate] = await MSCache.rangeRetDateForEvent();

    if (minRetDate === null && maxRetDate === null) {
      // キャッシュが存在しないため全部リクエストが必要
      flag = true;
      startDiff = startTimestamp;
      endDiff = endTimestamp;
    } else if (startTimestamp.toDate() < minRetDate) {
      // キャッシュ期間より過去のデータが必要
      flag = true;
      startDiff = startTimestamp;
      if (endTimestamp.toDate() > minRetDate) {
        endDiff = moment(minRetDate).add(-1, "seconds");
      } else {
        endDiff = endTimestamp;
      }
    } else if (endTimestamp.toDate() > maxRetDate) {
      // キャッシュ期間より未来のデータが必要
      flag = true;
      if (startTimestamp.toDate() > maxRetDate) {
        startDiff = startTimestamp;
      } else {
        startDiff = moment(maxRetDate).add(1, "seconds");
      }
      endDiff = endTimestamp;
    }

    // sails.log.debug("start : ", startTimestamp); //TODO: debug
    // sails.log.debug("end : ", endTimestamp); //TODO: debug
    // sails.log.debug("minRetDate : ", minRetDate); //TODO: debug
    // sails.log.debug("maxRetDate : ", maxRetDate); //TODO: debug
    // sails.log.debug("startDiff : ", startDiff); //TODO: debug
    // sails.log.debug("endDiff : ", endDiff); //TODO: debug

    return [flag, startDiff, endDiff];
  },

  saveAllEvents: async (events) => {
    await forEach(events, async (event) => await MSCache.createEvent(event));
  },

  /**
   * 最新イベントリストでキャッシュしたイベントデータを更新する。
   * @param {*} events Graph APIから取得した最新イベントリスト
   */
  updateAllEvents: async (events) => {
    // 取得した最新イベントのiCalUIdリストを作成する。
    const existiCalUIds = events.reduce(
      (acc, event) => [...acc, event.iCalUId],
      []
    );

    // 最新iCalUIdリストにないiCalUIdを持つキャッシュは削除されていると判断できる。
    const removingCaches = await EventCache.find({
      where: { iCalUId: { nin: existiCalUIds } },
    });

    // 削除されたと判断したキャッシュのiCalUIdを配列にする。
    const removingiCalUIds = removingCaches.reduce(
      (acc, cache) => [...acc, cache.iCalUId],
      []
    );

    // 削除対象のキャッシュを削除する。
    await MSCache.deleteEvent({
      iCalUId: { in: removingiCalUIds },
    });

    // 取得した最新イベントでキャッシュを更新する。
    await forEach(events, async (event) => await MSCache.updateEvent(event));
  },

  saveAllRoomEvents: async (events, roomEmail) => {
    await forEach(
      events,
      async (event) => await MSCache.createRoomEvent(event, roomEmail)
    );
  },

  /**
   * 最新Roomsイベントリストでキャッシュしたイベントデータを更新する。
   * @param {*} events Graph APIから取得した最新Roomsイベントリスト
   */
  updateAllRoomEvents: async (events, email) => {
    // 取得した最新イベントのiCalUIdリストを作成する。
    const existiCalUIds = events.reduce(
      (acc, event) => [...acc, event.iCalUId],
      []
    );

    // 最新iCalUIdリストにないiCalUIdを持つキャッシュは削除されていると判断できる。
    const removingCaches = await RoomEventCache.find({
      where: { email, iCalUId: { nin: existiCalUIds } },
    });

    // 削除されたと判断したキャッシュのiCalUIdを配列にする。
    const removingiCalUIds = removingCaches.reduce(
      (acc, cache) => [...acc, cache.iCalUId],
      []
    );

    // 削除対象のキャッシュを削除する。
    await MSCache.deleteRoomEvent({
      where: { email, iCalUId: { in: removingiCalUIds } },
    });

    // 取得した最新イベントでキャッシュを更新する。
    await forEach(
      events,
      async (event) => await MSCache.updateRoomEvent(event, email)
    );
  },

  //================================================
  // 登録
  createEvent: async ($event, isUserModified = false) => {
    // イベントの種類がseriesMasterの場合、キャッシュ対象外
    if ($event.type === "seriesMaster") {
      return;
    }
    // isUserModified=trueの場合、イベントがキャッシュ保持期間内がチェック
    if (isUserModified) {
      const [minRetDate, maxRetDate] = await MSCache.rangeRetDateForEvent();
      if (
        new Date($event.start.dateTime) > maxRetDate ||
        new Date($event.end.dateTime) < minRetDate
      ) {
        return;
      }
    }

    const event = _.cloneDeep($event);

    //  event.categoriesから各情報を取得する。
    let locationId;
    let categoryId;
    let roomId;
    let authorEmail;
    event.categories.forEach((item) => {
      const label = item.substring(0, item.lastIndexOf(" "));
      const value = item.slice(0, -1); // 先に末尾の.を削除しておく
      switch (label) {
        case MSGraph.getLocationLabelBase():
          locationId = value.replace(MSGraph.getLocationLabelBase(), "").trim();
          break;
        case MSGraph.getCategoryLabelBase():
          categoryId = value.replace(MSGraph.getCategoryLabelBase(), "").trim();
          break;
        case MSGraph.getRoomLabelBase():
          roomId = value.replace(MSGraph.getRoomLabelBase(), "").trim();
          break;
        case MSGraph.getAuthorLabelBase():
          authorEmail = value.replace(MSGraph.getAuthorLabelBase(), "").trim();
          break;
      }
    });

    //mongodbに保存できないため削除
    delete event["@odata.context"];
    delete event["@odata.etag"];

    // キャッシュ登録
    const cache = await EventCache.create({
      iCalUId: event.iCalUId,
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      author: authorEmail,
      seriesMasterId: !!event.seriesMasterId ? event.seriesMasterId : "",
      value: event,
      location: locationId,
      category: categoryId,
      room: roomId,
    }).fetch();

    // トラッキング追加
    if (isUserModified) {
      await MSCache.createEventCacheTracking(cache);
    }
  },

  // 更新
  updateEvent: async (
    $event,
    isUserModified = false,
    isTrackingReset = false
  ) => {
    // 事前チェック
    const preCheck = await EventCache.findOne({
      iCalUId: $event.iCalUId,
    });
    if (!preCheck) {
      // キャッシュに関して更新ではなく登録として処理(キャッシュ対象外eventを更新かけている場合に該当)
      await MSCache.createEvent($event, isUserModified);
      return;
    }

    // イベントの種類がseriesMasterの場合、キャッシュ対象外
    if ($event.type === "seriesMaster") {
      return;
    }
    // isUserModified=trueの場合、イベントがキャッシュ保持期間内がチェック
    if (isUserModified) {
      const [minRetDate, maxRetDate] = await MSCache.rangeRetDateForEvent();
      if (
        new Date($event.start.dateTime) > maxRetDate ||
        new Date($event.end.dateTime) < minRetDate
      ) {
        // 保持期間から外れた為、キャッシュ削除
        await MSCache.deleteEvent({ iCalUId: $event.iCalUId });
        return;
      }
    }

    const event = _.cloneDeep($event);

    //mongodbに保存できないため削除
    delete event["@odata.context"];
    delete event["@odata.etag"];
    delete event["@odata.associationLink"];

    //更新情報
    const data = {
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      value: event,
    };
    if (isTrackingReset) {
      data.tracking = null; // トラッキングとの同期解除
    }

    // DBのイベントキャッシュを更新する。
    const cache = await EventCache.updateOne({
      where: { iCalUId: event.iCalUId },
    }).set(data);

    // トラッキング追加
    if (isUserModified) {
      await MSCache.createEventCacheTracking(cache);
    }
  },

  // 削除
  deleteEvent: async (criteria) => {
    const caches = await EventCache.find(criteria).populate("tracking");
    const removeTrackings = caches.reduce(
      (acc, item) => (!!item.tracking ? [...acc, item.tracking.id] : [...acc]),
      []
    );
    if (removeTrackings.length > 0) {
      await EventCacheTracking.destroy({
        id: {
          in: removeTrackings,
        },
      });
    }
    await EventCache.destroy(criteria);
  },

  //================================================
  // 定期イベントのinstancesをキャッシュ保存する
  reflectEventForRecurrence: async (seriesMasterId, events) => {
    // キャッシュから一旦全削除
    const criteria = { seriesMasterId: seriesMasterId };
    await MSCache.deleteEvent(criteria);

    // instances分をキャッシュ保存
    await forEach(
      events,
      async (event) => await MSCache.createEvent(event, true)
    );
  },
  //================================================
  //================================================
  // 登録(RoomEvent)
  createRoomEvent: async ($event, email) => {
    const event = _.cloneDeep($event);

    //mongodbに保存できないため削除
    delete event["@odata.context"];
    delete event["@odata.etag"];

    await RoomEventCache.create({
      iCalUId: event.iCalUId,
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      email: email,
      value: event,
    });
  },

  // 更新(RoomEvent)
  updateRoomEvent: async ($event, email) => {
    const event = _.cloneDeep($event);

    //mongodbに保存できないため削除
    delete event["@odata.context"];
    delete event["@odata.etag"];

    // キャッシュ済みのイベントかチェックする。
    const preCheck = await RoomEventCache.findOne({
      email,
      iCalUId: event.iCalUId
    });

    // キャッシュになければ追加する。
    if (!preCheck) {
      await MSCache.createRoomEvent(event, email);
    }

    // キャッシュ済みなら更新する。
    else {
      await RoomEventCache.updateOne({
        where: { email, iCalUId: event.iCalUId },
      }).set({
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
        value: event,
      });
    }
  },

  // 削除(RoomEvent)
  deleteRoomEvent: async (criteria) => {
    await RoomEventCache.destroy(criteria);
  },

  //================================================
  //================================================
  // キャッシュトラッキングの登録
  createEventCacheTracking: async (eventCache) => {
    const check = await EventCacheTracking.find({ eventCache: eventCache.id });
    if (!check) {
      return; //既に登録済みのため登録不要
    }
    // trackingへの登録とeventCacheへの手動同期
    const tracking = await EventCacheTracking.create({
      eventCache: eventCache.id,
    }).fetch();

    await EventCache.updateOne({ where: { id: eventCache.id } }).set({
      tracking: tracking.id,
    });
  },

  // トラッキングが必要か否か
  isTrackingTarget: async (event) => {
    // 会議室ごとのオブジェクトに再加工
    const locations = await MSGraph.reduceLocations(event);
    const first = Object.keys(locations)[0]; // TODO:複数会議室未対応

    return (
      locations[first].status === "none" ||
      locations[first].status === "notResponded"
    );
  },
};

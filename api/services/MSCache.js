const moment = require("moment-timezone");
const { forEach } = require("p-iteration");

module.exports = {
  //Eventキャッシュが現在保持している範囲
  rageRetDateForEvent: async () => {
    const logs = await CacheLog.find({ type: "event", mode: "reset" }).sort(
      "createdAt DESC"
    );
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

    const [minRetDate, maxRetDate] = await MSCache.rageRetDateForEvent();

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

    sails.log.debug("start : ", startTimestamp); //TODO: debug
    sails.log.debug("end : ", endTimestamp); //TODO: debug
    sails.log.debug("minRetDate : ", minRetDate); //TODO: debug
    sails.log.debug("maxRetDate : ", maxRetDate); //TODO: debug
    sails.log.debug("startDiff : ", startDiff); //TODO: debug
    sails.log.debug("endDiff : ", endDiff); //TODO: debug

    return [flag, startDiff, endDiff];
  },

  saveAllEvents: async (events) => {
    await forEach(events, async (event) => await MSCache.createEvent(event));
  },

  saveAllRoomEvents: async (events, roomEmail) => {
    await forEach(
      events,
      async (event) => await MSCache.createRoomEvent(event, roomEmail)
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
      const [minRetDate, maxRetDate] = await MSCache.rageRetDateForEvent();
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
  updateEvent: async ($event, isUserModified = false) => {
    const event = _.cloneDeep($event);

    //mongodbに保存できないため削除
    delete event["@odata.context"];
    delete event["@odata.etag"];

    // キャッシュ更新
    const cache = await EventCache.updateOne({ iCalUId: event.iCalUId }).set({
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      value: event,
    });

    // トラッキング追加
    if (isUserModified && !cache.tracking) {
      await MSCache.createEventCacheTracking(cache);
    }
  },

  // 削除
  deleteEvent: async (criteria) => {
    const caches = await EventCache.find(criteria).populate("tracking");
    await EventCacheTracking.destroy({
      id: { in: caches.map((item) => item.tracking.id) },
    });
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
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      email: email,
      value: event,
    });
  },

  // 更新(RoomEvent)
  updateRoomEvent: async ($event) => {
    const event = _.cloneDeep($event);

    //mongodbに保存できないため削除
    delete event["@odata.context"];
    delete event["@odata.etag"];

    await RoomEventCache.updateOne({ iCalUId: event.iCalUId }).set({
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      value: event,
    });
  },

  // 削除(RoomEvent)
  deleteRoomEvent: async (criteria) => {
    await RoomEventCache.destroy(criteria);
  },

  //================================================
  //================================================
  // キャッシュトラッキングの登録
  createEventCacheTracking: async (eventCache) => {
    const tracking = await EventCacheTracking.create({
      eventCache: eventCache.id,
    }).fetch();
    await EventCache.updateOne(eventCache.id).set({ tracking: tracking.id });
  },
};

const MSGraph = require("./MSGraph");
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
      endDiff = moment(minRetDate).add(-1, "seconds");
    } else if (endTimestamp.toDate() > maxRetDate) {
      // キャッシュ期間より未来のデータが必要
      flag = true;
      startDiff = moment(maxRetDate).add(1, "seconds");
      endDiff = endTimestamp;
    }

    return [flag, startDiff, endDiff];
  },

  saveAllEvents: async (events) => {
    await forEach(events, async (event) => await MSCache.saveEvent(event));
  },

  saveEvent: async (event) => {
    let locationId;
    let categoryId;
    let roomId;
    let authorEmail;

    //  event.categoriesから各情報を取得する。
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
    delete event["@odata.etag"];

    // 登録
    await EventCache.create({
      iCalUId: event.iCalUId,
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      author: authorEmail,
      value: event,
      location: locationId,
      category: categoryId,
      room: roomId,
    });
  },
};

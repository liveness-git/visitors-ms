const MSGraph = require("./MSGraph");
const { forEach } = require("p-iteration");

module.exports = {
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

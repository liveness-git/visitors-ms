const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");
const MSCache = require("../services/MSCache");
const moment = require("moment-timezone");
const { forEach } = require("p-iteration");

const cacheEmail = sails.config.visitors.credential.cacheAccount.username;

module.exports = {
  /**
   * キャッシュ全削除後、指定期間のイベントを全登録
   */
  saveEvents: async () => {
    // キャッシュ保持期間の設定（指定日を起点に未来１か月分）
    const timestamp = new Date().getTime();
    const startTimestamp = moment(timestamp).startOf("date");
    const endTimestamp = moment(timestamp).endOf("date").add(1, "months");

    // キャッシュ用アカウント設定
    const localAccountId = await MSAuth.acquireCacheAccountId();
    // msalから有効なaccessToken取得(キャッシュ用)
    const cacheToken = await MSAuth.acquireToken(localAccountId);

    // graphAPIからevent取得
    const events = await MSGraph.getCalendarEvents(cacheToken, cacheEmail, {
      startDateTime: moment(startTimestamp).format(),
      endDateTime: moment(endTimestamp).format(),
      $orderBy: "start/dateTime",
      $select: MSGraph.visitorsSelecter,
      $filter: `categories/any(c:c eq '${MSGraph.getVisitorsLabel()}')`,
    });

    // キャッシュ全削除
    await EventCacheTracking.destroy({});
    await EventCache.destroy({});
    // 指定期間のイベントを全登録
    await MSCache.saveAllEvents(events);

    //-------------------
    // 会議室別画面に表示するRooms情報を取得
    // キャッシュ全削除
    await RoomEventCache.destroy({});

    // LivenessRoomsを表示する会議室のみが対象
    const rooms = await Room.find({ displayLivenessRooms: true });
    const roomEmails = rooms.map((room) => room.email);

    // 対象会議室分回す
    await forEach(roomEmails, async (roomEmail) => {
      // graphAPIからLIVENESS Roomsのevent取得
      const lrooms = await MSGraph.getCalendarEvents(cacheToken, roomEmail, {
        startDateTime: moment(startTimestamp).format(),
        endDateTime: moment(endTimestamp).format(),
        $orderBy: "start/dateTime",
        $select: MSGraph.lroomsSelector,
        $filter: `categories/any(c:c eq '${MSGraph.getLroomsLabel()}')`,
      });
      // 指定期間のRoomsイベントを全登録
      await MSCache.saveAllRoomEvents(lrooms, roomEmail);
    });
    //-------------------

    // キャッシュログ作成
    await CacheLog.create({
      type: "event",
      mode: "reset",
      start: startTimestamp.toDate(),
      end: endTimestamp.toDate(),
    });
  },

  /**
   * 会議室のstatus反映の為に追跡する
   */
  tracking: async () => {
    // キャッシュ用アカウント設定
    const localAccountId = await MSAuth.acquireCacheAccountId();
    // msalから有効なaccessToken取得(キャッシュ用)
    const cacheToken = await MSAuth.acquireToken(localAccountId);

    // EventCacheTrackingに登録されている情報全てを処理
    const targets = await EventCacheTracking.find().populate("eventCache");
    if (targets.length === 0) {
      return;
    }

    await forEach(targets, async (target) => {
      // GraphAPIから最新eventを取得
      const event = await MSGraph.getEventById(
        cacheToken,
        cacheEmail,
        target.eventCache.value.id
      );

      // 会議室のstatusが更新されているかチェック
      const isStatusNone = await MSCache.isTrackingTarget(event);
      if (isStatusNone) {
        return; // 継続して追跡が必要なため、キャッシュ更新対象外
      }

      //TODO:
      // GraphAPI通信時間とキャッシュ時間を比較してデグレしないようにする？？
      if (1) {
        await MSCache.updateEvent(event, false, true); // キャッシュに反映
        await EventCacheTracking.destroy(target.id); // Tracking対象から外れるため削除
      }
    });

    // // キャッシュログ作成 //TODO: 処理回数が多いためコメントアウト
    // await CacheLog.create({
    //   type: "event",
    //   mode: "tracking",
    // });
  },
};

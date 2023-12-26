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
   * キャッシュ情報を更新する。
   */
  patchJob: async () => {
    //-------------------
    // キャッシュログから最新を取得する。
    const cacheLogs = await CacheLog.find({
      sort: "start DESC",
      limit: 1,
    });

    // キャッシュログに情報がない場合は処理をキャンセルする。
    if (!cacheLogs || cacheLogs.length === 0) {
      return;
    }

    // 最新キャッシュログから検索範囲(開始日時～終了日時)を取得する。
    const cacheLog = cacheLogs[0];
    const { start, end /*, type, mode*/ } = cacheLog;
    const startTimestamp = moment(start);
    const endTimestamp = moment(end);

    // キャッシュ用アカウントを取得する。
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

    // キャッシュを更新
    await MSCache.updateAllEvents(events);

    //-------------------

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
      await MSCache.updateAllRoomEvents(lrooms);
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
      // 最新のイベントキャッシュ取得
      const latest = await EventCache.find(target.eventCache.id);
      if (!latest) {
        return; // 削除されているeventのため処理不要
      }

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
      // GraphAPI通信時間とキャッシュ時間を比較してデグレしないようにする必要はある？？
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

const moment = require("moment-timezone");
const { filter, some } = require("p-iteration");

module.exports = {
  friendlyName: "get target from events",

  description:
    "graphAPIからevent取得し、対象ロケーションの会議室予約のみにフィルタリングします",

  inputs: {
    categoriesFilter: {
      type: "string",
      description: "GraphAPIのcategoriesを絞り込む際のワード",
      required: false,
    },
    accessToken: {
      type: "string",
      description: "GraphAPIに問い合わせる時のアクセストークン",
      required: true,
    },
    email: {
      type: "string",
      description: "GraphAPIに問い合わせる時のメールアドレス",
      required: true,
    },
    startTimestamp: {
      type: "ref",
      description: "開始日時のタイムスタンプ(moment.Moment)",
      required: true,
    },
    endTimestamp: {
      type: "ref",
      description: "終了日時のタイムスタンプ(moment.Moment)",
      required: true,
    },
    location: {
      type: "string",
      description: "ロケーションurl名",
      required: true,
    },
    roomType: {
      type: "string",
      description:
        "対象会議室のタイプを絞り込む必要がある場合のみ指定します（rooms または free）",
      required: false,
    },
    customVisitorsSelecter: {
      type: "string",
      description: "MSGraphの$selectに渡す値をカスタムしたい場合に使用する",
      required: false,
    },
  },

  fn: async function (inputs, exits) {
    const conditions = {
      startDateTime: moment(inputs.startTimestamp).format(),
      endDateTime: moment(inputs.endTimestamp).format(),
      $orderBy: "start/dateTime",
      $select: !!inputs.customVisitorsSelecter
        ? inputs.customVisitorsSelecter
        : MSGraph.visitorsSelecter,
      $top: sails.config.visitors.calendarViewCount,
    };
    // filterの設定
    if (inputs.categoriesFilter) {
      conditions[
        "$filter"
      ] = `categories/any(c:c eq '${inputs.categoriesFilter}')`;
    }

    // CacheProc - start ----------------------------------->
    // キャッシュ存在チェック
    const caches = await CacheCalendarView.find({
      email: inputs.email,
      conditions: JSON.stringify(conditions),
    }).sort("timestamp DESC");

    // キャッシュが複数できてしまっていた時の対策
    const cache = !!caches.length ? caches[0] : null;

    sails.log.debug("キャッシュ：", !!cache ? cache.timestamp : null); //TODO: debug
    sails.log.debug(
      "リミット ：",
      moment()
        .subtract(sails.config.visitors.calendarViewCache, "minutes")
        .toDate()
        .getTime()
    ); //TODO: debug

    if (!!cache) {
      // 現在時刻から指定分以内かつ強制更新OFFならキャッシュ利用
      if (
        cache.timestamp >=
          moment()
            .subtract(sails.config.visitors.calendarViewCache, "minutes")
            .toDate()
            .getTime() &&
        !cache.isUpdateMe
      ) {
        sails.log.debug("キャッシュ利用", conditions); //TODO: debug

        // キャッシュ利用
        return exits.success(cache.data);
      } else {
        // キャッシュ削除
        await CacheCalendarView.destroyOne(cache.id);
      }
    }
    // CacheProc - end -----------------------------------<

    sails.log.debug("リクエスト"); //TODO: debug

    // graphAPIからevent取得
    const events = await MSGraph.getCalendarEvents(
      inputs.accessToken,
      inputs.email,
      conditions
    );

    // CacheProc - start ----------------------------------->
    // キャッシュ保存用変数を一部先に定義
    const newCache = {
      email: inputs.email,
      conditions: JSON.stringify(conditions),
      timestamp: new Date().getTime(),
      isUpdateMe: false,
    };
    // CacheProc - end -----------------------------------<

    // ロケーションの取得
    const location = await Location.findOne({ url: inputs.location });

    // event情報を対象ロケーションの会議室予約のみにフィルタリング。
    const $result = await filter(events, async (event) => {
      if (event.isCancelled) {
        return false;
      }
      if (event.locations.length === 0) {
        return false;
      }
      return await some(event.locations, async (eventLocation) => {
        if (!eventLocation.hasOwnProperty("locationUri")) {
          return false;
        }
        const room = await Room.findOne({
          email: eventLocation.locationUri,
          location: location.id,
        });
        if (!!inputs.roomType) {
          return !!room && room.type === inputs.roomType; // 会議室タイプの指定
        } else {
          return !!room;
        }
      });
    });

    // キャッシュ保存できるようにetagを削除
    const result = $result.map((event) => {
      delete event["@odata.etag"];
      return event;
    });

    // CacheProc - start ----------------------------------->
    // キャッシュ保存
    await CacheCalendarView.create({
      ...newCache,
      // iCalUIds: result.map((event) => event.iCalUId),
      data: result,
    });
    // CacheProc - end -----------------------------------<

    return exits.success(result);
  },
};

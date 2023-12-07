const moment = require("moment-timezone");
const { filter, some } = require("p-iteration");

module.exports = {
  friendlyName: "get target from events",

  description:
    "graphAPIからevent取得し、対象ロケーションの会議室予約のみにフィルタリングします",

  inputs: {
    categoriesFilter: {
      //1
      type: "string",
      description: "GraphAPIのcategoriesを絞り込む際のワード",
      required: false,
    },
    accessToken: {
      //2
      type: "string",
      description: "GraphAPIに問い合わせる時のアクセストークン",
      required: true,
    },
    email: {
      //3
      type: "string",
      description: "GraphAPIに問い合わせる時のメールアドレス",
      required: true,
    },
    startTimestamp: {
      //4
      type: "ref",
      description: "開始日時のタイムスタンプ(moment.Moment)",
      required: true,
    },
    endTimestamp: {
      //5
      type: "ref",
      description: "終了日時のタイムスタンプ(moment.Moment)",
      required: true,
    },
    location: {
      //6
      type: "string",
      description: "ロケーションurl名",
      required: true,
    },
    cacheCriteria: {
      //7
      type: "ref",
      description:
        "キャッシュ抽出条件 (期間とロケーション以外がある場合)。キャッシュ機能自体を使用しない場合、'not-used'を指定する。",
      required: false,
    },
    isLroomsEvents: {
      //8
      type: "boolean",
      description: "LIVENESS Roomsのイベント取得時はTrue",
      required: false,
      defaultsTo: false,
    },
    // roomType: {
    //   type: "string",
    //   description:
    //     "対象会議室のタイプを絞り込む必要がある場合のみ指定します（rooms または free）",
    //   required: false,
    // },
  },

  fn: async function (inputs, exits) {
    // ロケーションの取得
    const location = await Location.findOne({ url: inputs.location });

    let isRequestLive = true;
    let startDiff = inputs.startTimestamp;
    let endDiff = inputs.endTimestamp;
    let eventCache = [];
    let eventMS = [];

    // キャッシュ利用する場合
    if (inputs.cacheCriteria !== "not-used") {
      // キャッシュ抽出条件
      const criteria = {
        start: { ">=": inputs.startTimestamp.toDate() },
        end: { "<=": inputs.endTimestamp.toDate() },
        ...inputs.cacheCriteria,
      };
      if (!inputs.isLroomsEvents) {
        criteria.location = location.id;
      }

      // キャッシュ取得
      let $eventCache;
      if (inputs.isLroomsEvents) {
        $eventCache = await RoomEventCache.find(criteria);
      } else {
        $eventCache = await EventCache.find(criteria);
      }
      eventCache = $eventCache.map((item) => item.value);

      // キャッシュ以外にGraphAPIへイベント取得のリクエストが必要かチェック
      [isRequestLive, startDiff, endDiff] = await MSCache.checkRequestLiveEvent(
        inputs.startTimestamp,
        inputs.endTimestamp
      );

      sails.log.debug("criteria : ", criteria); //TODO: debug
      sails.log.debug("start : ", inputs.startTimestamp); //TODO: debug
      sails.log.debug("end : ", inputs.endTimestamp); //TODO: debug
      sails.log.debug("startDiff : ", startDiff); //TODO: debug
      sails.log.debug("endDiff : ", endDiff); //TODO: debug
    }

    // 必要に応じてGraphAPIから取得
    if (isRequestLive) {
      const conditions = {
        startDateTime: moment(startDiff).format(),
        endDateTime: moment(endDiff).format(),
        $orderBy: "start/dateTime",
        $select: inputs.isLroomsEvents
          ? MSGraph.lroomsSelector
          : MSGraph.visitorsSelecter,
        $top: sails.config.visitors.calendarViewCount,
      };
      // filterの設定
      if (inputs.categoriesFilter) {
        conditions[
          "$filter"
        ] = `categories/any(c:c eq '${inputs.categoriesFilter}')`;
      }

      // graphAPIからevent取得
      eventMS = await MSGraph.getCalendarEvents(
        inputs.accessToken,
        inputs.email,
        conditions
      );
    }

    // キャッシュとGraphAPIをマージ
    const events = [...eventCache, ...eventMS];
    events.sort((a, b) => a.startDateTime - b.startDateTime);

    // event情報を対象ロケーションの会議室予約のみにフィルタリング。
    const result = await filter(events, async (event) => {
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
        // if (!!inputs.roomType) {
        //   return !!room && room.type === inputs.roomType; // 会議室タイプの指定
        // } else {
        return !!room;
        // }
      });
    });
    return exits.success(result);
  },
};

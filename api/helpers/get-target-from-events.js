const moment = require("moment-timezone");
const { filter, some } = require("p-iteration");

module.exports = {
  friendlyName: "get target from events",

  description:
    "graphAPIからevent取得し、対象ロケーションの会議室予約のみにフィルタリングします",

  inputs: {
    accessToken: {
      type: "string",
      description: "ログインユーザーのアクセストークン",
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
  },

  fn: async function (inputs, exits) {
    // graphAPIからevent取得
    const events = await MSGraph.getCalendarEvents(
      inputs.accessToken,
      inputs.email,
      {
        startDateTime: moment(inputs.startTimestamp).format(),
        endDateTime: moment(inputs.endTimestamp).format(),
        $filter: "isCancelled eq false",
        $orderBy: "start/dateTime",
        $select:
          "start,end,iCalUId,subject,organizer,location,locations,attendees",
      }
    );

    // ロケーションの取得
    const location = await Location.findOne({ url: inputs.location });

    // event情報を対象ロケーションの会議室予約のみにフィルタリング。
    const result = await filter(events, async (event) => {
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
    return exits.success(result);
  },
};

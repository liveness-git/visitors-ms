const { map } = require("p-iteration");

module.exports = {
  friendlyName: "get livenessRooms events",

  description:
    "graphAPIからLivenessRoomsで登録されたeventを取得(対象ロケーションの会議室予約のみにフィルタリング)します。",

  inputs: {
    getTargetFromEventsParams: {
      type: "ref", //Array
      description: "getTargetFromEventsParamsへ引き継ぐパラメータ群",
      required: true,
    },
    roomEmails: {
      type: "ref", //Array
      description: "会議室のメールアドレス",
      required: true,
    },
  },

  fn: async function (inputs, exits) {
    const params = [...inputs.getTargetFromEventsParams];

    const request = async (email) => {
      // LivenessRoomsを表示しない場合、空配列を返す。
      if (!(await Room.findOne({ email: email, displayLivenessRooms: true }))) {
        return [];
      }

      params[1] = email; // emailを会議室アドレスに上書き
      params[6] = "start,end,subject,categories,locations,attendees"; // customVisitorsSelecterを上書き

      return await sails.helpers.getTargetFromEvents(
        // "rooms:created",
        "rooms:entered", //TODO:debug★★★後で変更
        ...params
      );
    };

    const results = await Promise.all(
      inputs.roomEmails.map((email) => request(email))
    );
    const $result = results.reduce((prev, cur) => prev.concat(cur), []);

    // データ整形
    const result = await map($result, async (event) => {
      // 会議室ごとのオブジェクトに再加工
      const locations = await MSGraph.reduceLocations(event);
      const first = Object.keys(locations)[0]; // LivenessRoomsからの予約なので固定値

      return {
        roomEmail: locations[first].locationUri,
        roomStatus: locations[first].status,
        subject: event.subject,
        apptTime: `${MSGraph.getDateFormat(
          event.start.dateTime
        )} ${MSGraph.getTimeFormat(
          event.start.dateTime
        )}-${MSGraph.getTimeFormat(event.end.dateTime)}`,
        startDateTime: MSGraph.getTimestamp(event.start.dateTime),
        endDateTime: MSGraph.getTimestamp(event.end.dateTime),
        reservationName: event.attendees[0].emailAddress.name, // LivenessRooms仕様による
      };
    });

    return exits.success(result);
  },
};

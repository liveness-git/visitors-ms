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
    const request = async (email, index) => {
      // GraphAPI負荷を減らすため、指定秒待つ
      await new Promise((resolve) => setTimeout(resolve, index * 500));

      const params = [...inputs.getTargetFromEventsParams];
      params[1] = email; // emailを会議室アドレスに上書き
      params[6] = true; // LIVENESS Roomsのイベント取得時はTrue

      return await sails.helpers.getTargetFromEvents(
        MSGraph.getLroomsLabel(),
        ...params
      );
    };

    const results = await Promise.all(
      inputs.roomEmails.map((email, index) => request(email, index))
    );
    // 調整 *** 並列 ← await追加して直列に変更
    // const results = [];
    // for (let i = 0; i < inputs.roomEmails.length; i++) {
    //   results.push(await request(inputs.roomEmails[i]));
    // }

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

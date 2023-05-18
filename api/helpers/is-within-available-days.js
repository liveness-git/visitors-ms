const moment = require("moment-timezone");

module.exports = {
  friendlyName: "is within available days",

  description: "指定された会議室が予約可能かつ予約可能日数内か判定します",

  inputs: {
    room: {
      type: "ref",
      description: "予約したい会議室のRoom情報",
      required: true,
    },
    endDateTime: {
      type: "ref", // Date型
      description: "予約終了日時",
      required: true,
    },
  },

  fn: async function (inputs, exits) {
    let result = false;

    if (inputs.room.noReservations) {
      // 予約不可の場合
      result = false;
    } else if (!inputs.room.reservationPeriod) {
      // 予約可能日数の指定がない場合、予約可能
      result = true;
    } else {
      // 予約可能日数の指定がある場合、予約制限日時を算出して判断
      const limitOver = moment()
        .startOf("date")
        .add(inputs.room.reservationPeriod, "d");

      // limitOver > endDateTime
      result = limitOver.isAfter(moment(inputs.endDateTime));
    }

    return exits.success(result);
  },
};

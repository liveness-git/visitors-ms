const moment = require("moment-timezone");

module.exports = {
  friendlyName: "Attach visitor data",

  description:
    "渡されたGraphAPIのevent情報にvisitorの情報をマージして返します。",

  inputs: {
    event: {
      type: "ref",
      description: "GraphAPIのevent情報",
      required: true,
    },
    email: {
      type: "string",
      description: "ログインユーザーのメールアドレス",
      required: true,
    },
    isFront: {
      type: "boolean",
      description: "ログインユーザーがフロントか否か",
      required: true,
    },
  },

  fn: async function (inputs, exits) {
    const event = inputs.event;

    // Visitorsに登録されていないeventは対象外とする
    const visitor = await Visitor.findOne({ iCalUId: event.iCalUId });
    if (!visitor) {
      return exits.success(undefined);
    }

    const startDate = MSGraph.getDateFormat(event.start.dateTime);
    const startTime = MSGraph.getTimeFormat(event.start.dateTime);

    // 会議室ごとのオブジェクトに再加工
    const locations = await MSGraph.reduceLocations(event);

    const first = Object.keys(locations)[0]; // TODO:複数会議室未対応
    const room = await Room.findOne(first);

    // 清掃オプション時間
    const cleaningTime = room.cleaningOption
      ? sails.config.visitors.cleaningMinute * 60 * 1000
      : 0;

    // 清掃時間が含まれている場合は減算
    const endDateTime = MSGraph.getTimestamp(event.end.dateTime) - cleaningTime;
    const endTime = moment(endDateTime).format("HH:mm");

    const author = sails.config.visitors.isOwnerMode
      ? { ...event.attendees[1] }
      : { ...event.organizer };

    const result = {
      iCalUId: event.iCalUId,
      subject: event.subject,
      apptTime: `${startDate} ${startTime}-${endTime}`,
      startDateTime: MSGraph.getTimestamp(event.start.dateTime),
      endDateTime: endDateTime, // 清掃時間減算済み
      cleaningTime: cleaningTime, // 清掃時間
      roomName: event.location.displayName, //表での表示用
      roomStatus: locations[first].status, // 表での表示用
      reservationName: author.emailAddress.name,
      reservationStatus: event.attendees.filter(
        (user) => user.emailAddress.address === author.emailAddress.address
      )[0].status.response,
      isAuthor: inputs.isFront || author.emailAddress.address === inputs.email,
      isAttendees: event.attendees.some(
        (user) => user.emailAddress.address === inputs.email
      ),
      isMSMultipleLocations: !!(event.locations.length - 1), // 複数ある場合は編集不可にするためのフラグ(会議室以外の場所が登録されている可能性を考慮)
      visitorId: "",
      usageRange: "outside",
      visitCompany: [{ name: "", rep: "" }],
      mailto: event.attendees.reduce(
        (newObj, user) => {
          if (user.type === "resource") {
            // リソースは外す
          } else if (
            // 予約者はauthors[0]に移動
            user.emailAddress.address === author.emailAddress.address
          ) {
            newObj["authors"][0] = {
              status: user.status.response,
              ...user.emailAddress,
            };
          } else if (
            // 代表アカウントはauthors[1]に移動
            user.emailAddress.address ===
            sails.config.visitors.credential.username
          ) {
            newObj["authors"][1] = {
              status: user.status.response,
              ...user.emailAddress,
            };
          } else {
            // その他は通常どおりに移動
            if (_.isArray(newObj[user.type])) {
              newObj[user.type].push({
                status: user.status.response,
                ...user.emailAddress,
              });
            } else {
              newObj[user.type] = [
                { status: user.status.response, ...user.emailAddress },
              ];
            }
          }
          return newObj;
        },
        { authors: [], required: [], optional: [] }
      ),
      resourcies: Object.keys(locations).reduce((newObj, room) => {
        newObj[room] = {
          roomName: locations[room].displayName,
          roomEmail: locations[room].locationUri,
          roomStatus: locations[room].status,
          teaSupply: false,
          numberOfTeaSupply: 0,
          teaDetails: "",
        };
        return newObj;
      }, {}),
      comment: "",
      contactAddr: "",
      checkIn: "",
      checkOut: "",
      visitorCardNumber: "",
      reservationInfo: undefined,
      lastUpdated: 0,
      seriesMasterId: event.seriesMasterId ? event.seriesMasterId : undefined,
      recurrence: event.recurrence ? event.recurrence : undefined,
      eventType: event.type,
      withTeams: event.isOnlineMeeting ? true : false,
      isChangedByRooms: MSGraph.isChangedByRooms(event),
    };

    result.visitorId = visitor.id;
    result.usageRange = visitor.usageRange;
    result.visitCompany = visitor.visitCompany;
    result.numberOfVisitor = visitor.numberOfVisitor;
    result.numberOfEmployee = visitor.numberOfEmployee;
    Object.keys(visitor.resourcies).map((room) => {
      if (result.resourcies.hasOwnProperty(room)) {
        result.resourcies[room] = {
          ...result.resourcies[room],
          ...visitor.resourcies[room],
        };
      }
    });
    result.comment = visitor.comment;
    result.contactAddr = visitor.contactAddr;
    result.checkIn = visitor.checkIn;
    result.checkOut = visitor.checkOut;
    result.visitorCardNumber = visitor.visitorCardNumber;
    result.reservationInfo = !!visitor.reservationInfo
      ? visitor.reservationInfo
      : undefined;
    result.lastUpdated = visitor.updatedAt;

    return exits.success(result);
  },
};

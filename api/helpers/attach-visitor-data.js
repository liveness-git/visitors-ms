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
    const startDate = MSGraph.getDateFormat(event.start.dateTime);
    const startTime = MSGraph.getTimeFormat(event.start.dateTime);
    const endTime = MSGraph.getTimeFormat(event.end.dateTime);
    // 会議室ごとのオブジェクトに再加工
    const locations = await MSGraph.reduceLocations(event);

    const first = Object.keys(locations)[0]; // TODO:複数会議室未対応

    const author = sails.config.visitors.isOwnerMode
      ? { ...event.attendees[1] }
      : { ...event.organizer };

    const result = {
      iCalUId: event.iCalUId,
      subject: event.subject,
      apptTime: `${startDate} ${startTime}-${endTime}`,
      startDateTime: MSGraph.getTimestamp(event.start.dateTime),
      endDateTime: MSGraph.getTimestamp(event.end.dateTime),
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
      visitCompany: "",
      visitorName: "",
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
      lastUpdated: 0,
      seriesMasterId: event.seriesMasterId ? event.seriesMasterId : undefined,
      recurrence: event.recurrence ? event.recurrence : undefined,
      eventType: event.type,
    };

    const visitor = await Visitor.findOne({ iCalUId: event.iCalUId });
    if (!!visitor) {
      result.visitorId = visitor.id;
      result.usageRange = visitor.usageRange;
      result.visitCompany = visitor.visitCompany;
      result.visitorName = visitor.visitorName;
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
      result.lastUpdated = visitor.updatedAt;
    }
    return exits.success(result);
  },
};

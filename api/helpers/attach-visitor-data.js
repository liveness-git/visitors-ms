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
  },

  fn: async function (inputs, exits) {
    const event = inputs.event;
    const startDate = MSGraph.getDateFormat(event.start.dateTime);
    const startTime = MSGraph.getTimeFormat(event.start.dateTime);
    const endTime = MSGraph.getTimeFormat(event.end.dateTime);
    // 会議室ごとのオブジェクトに再加工
    const locations = await MSGraph.reduceLocations(event);

    const first = Object.keys(locations)[0]; // TODO:複数会議室未対応

    const result = {
      iCalUId: event.iCalUId,
      subject: event.subject,
      apptTime: `${startDate} ${startTime}-${endTime}`,
      startDateTime: MSGraph.getTimestamp(event.start.dateTime),
      endDateTime: MSGraph.getTimestamp(event.end.dateTime),
      roomName: event.location.displayName, //表での表示用
      roomStatus: locations[first].status, // 表での表示用
      reservationName: event.organizer.emailAddress.name,
      isAuthor: event.organizer.emailAddress.address === inputs.email,
      // isAuthor:event.isOrganizer,// TODO:代理人が所有者の代わりにイベントを主催した場合にも適用される。どちらが正解？
      isMSMultipleLocations: !!(event.locations.length - 1), // 複数ある場合は編集不可にするためのフラグ(会議室以外の場所が登録されている可能性を考慮)
      visitorId: "",
      visitCompany: "",
      visitorName: "",
      mailto: event.attendees.reduce((newArray, user) => {
        if (
          user.type === "required" &&
          user.emailAddress.address !== event.organizer.emailAddress.address
        ) {
          newArray.push({ ...user.emailAddress });
        }
        return newArray;
      }, []),
      resourcies: Object.keys(locations).reduce((newObj, room) => {
        newObj[room] = {
          roomName: locations[room].displayName,
          roomEmail: locations[room].locationUri,
          roomStatus: locations[room].status,
          teaSupply: false,
          numberOfVisitor: 0,
          numberOfEmployee: 0,
        };
        return newObj;
      }, {}),
      comment: "",
      contactAddr: "",
      checkIn: "",
      checkOut: "",
      visitorCardNumber: "",
    };

    const visitor = await Visitor.findOne({ iCalUId: event.iCalUId });
    if (!!visitor) {
      result.visitorId = visitor.id;
      result.visitCompany = visitor.visitCompany;
      result.visitorName = visitor.visitorName;
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
    }
    return exits.success(result);
  },
};
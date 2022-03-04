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
    const result = {
      iCalUId: event.iCalUId,
      apptTime: `${startDate} ${startTime}-${endTime}`,
      roomName: event.locations[0].displayName,
      roomEmail: event.locations[0].locationUri,
      reservationName: event.organizer.emailAddress.name,
      isAuthor: event.organizer.emailAddress.address === inputs.email,
      visitorId: "",
      visitCompany: "",
      visitorName: "",
      teaSupply: false,
      numberOfVisitor: 0,
      numberOfEmployee: 0,
      comment: "",
      contactAddr: "",
    };

    const visitor = await Visitor.findOne({ iCalUId: event.iCalUId });
    if (!!visitor) {
      result.visitorId = visitor.id;
      result.visitCompany = visitor.visitCompany;
      result.visitorName = visitor.visitorName;
      result.teaSupply = visitor.teaSupply;
      result.numberOfVisitor = visitor.numberOfVisitor;
      result.numberOfEmployee = visitor.numberOfEmployee;
      result.comment = visitor.comment;
      result.contactAddr = visitor.contactAddr;
    }
    return exits.success(result);
  },
};

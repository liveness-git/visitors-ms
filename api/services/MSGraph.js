const moment = require("moment-timezone");
const { reduce } = require("p-iteration");

const baseUrl = "https://graph.microsoft.com/v1.0/users";
const labelTitle = "Visitors:";
const visitorsSelecter =
  "start,end,iCalUId,subject,categories,organizer,location,locations,attendees,type,seriesMasterId,recurrence";

module.exports = {
  baseUrl,

  getEventById: async (accessToken, email, id) => {
    const path = `events/${id}`;
    const options = {
      method: "GET",
      params: { $select: visitorsSelecter },
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    };
    const result = await MSGraph.request(accessToken, email, path, options);
    // return result.data.value;
    return result.data;
  },

  getEventsBySeriesMasterId: async (
    accessToken,
    email,
    seriesMasterId,
    iCalUId = null,
    selecter = null
  ) => {
    const path = `events/${seriesMasterId}/instances`;
    const options = {
      method: "GET",
      params: {
        startDateTime: moment(new Date(0)).startOf("date").add(1, "s").format(),
        endDateTime: moment(new Date("9999", "11", "31"))
          .endOf("date")
          .format(),
        $select: !!selecter ? selecter : visitorsSelecter,
      },
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    };

    if (!!iCalUId) {
      options.params.$filter = `iCalUId eq '${iCalUId}'`;
    }

    return await MSGraph.getDataValues(accessToken, email, path, options);
  },

  getEventByIcaluid: async (accessToken, email, iCalUId) => {
    const path = "events";
    const options = {
      method: "GET",
      params: {
        $filter: `iCalUId eq '${iCalUId}'`,
      },
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    };
    const result = await MSGraph.request(accessToken, email, path, options);
    return result.data.value[0];
  },

  getSchedule: async (accessToken, email, data) => {
    // TODO: calendar/getScheduleのGraphAPI、３か月先以降の予定がtimezone絡みでおかしくなるため
    // TODO: リクエスト前にtimezoneをUTCに変換 ⇒ 結果を日本時間に戻して返す。

    const strDateTimeTail = ".0000000";
    const timezoneDiff = sails.config.visitors.timezoneDiff * 60 * 60 * 1000;

    // timezone ⇒ UTC
    const startTimestamp =
      MSGraph.getTimestamp(data.startTime.dateTime + strDateTimeTail) -
      timezoneDiff;
    const endTimestamp =
      MSGraph.getTimestamp(data.endTime.dateTime + strDateTimeTail) -
      timezoneDiff;

    const remake = _.cloneDeep(data);
    remake.startTime.dateTime = MSGraph.getGraphDateTime(startTimestamp);
    remake.startTime.timeZone = "utc";
    remake.endTime.dateTime = MSGraph.getGraphDateTime(endTimestamp);
    remake.endTime.timeZone = "utc";

    const path = "calendar/getSchedule";
    const options = {
      method: "POST",
      data: remake,
      // headers: {
      //   Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      // },
    };
    const result = await MSGraph.request(accessToken, email, path, options);
    // return result.data.value;

    // UTC ⇒ timezone
    const newResult = result.data.value.map((item) => {
      const newItem = _.cloneDeep(item);
      newItem.scheduleItems = item.scheduleItems.map((schedule) => {
        const start =
          MSGraph.getTimestamp(schedule.start.dateTime) + timezoneDiff;
        const end = MSGraph.getTimestamp(schedule.end.dateTime) + timezoneDiff;

        const newSchedule = _.cloneDeep(schedule);
        newSchedule.start.dateTime =
          MSGraph.getGraphDateTime(start) + strDateTimeTail;
        newSchedule.start.timeZone = "Tokyo Standard Time";
        newSchedule.end.dateTime =
          MSGraph.getGraphDateTime(end) + strDateTimeTail;
        newSchedule.end.timeZone = "Tokyo Standard Time";

        return newSchedule;
      });
      return newItem;
    });
    return newResult;
  },

  // 引数のroomEmail配列から予約可能なemailのみに絞り込んで返す
  getAvailableRooms: async (
    accessToken,
    email,
    startTimestamp,
    endTimestamp,
    roomEmails,
    isConsiderCleaning = false // endTimestampに清掃時間が含まれていない場合true
  ) => {
    const availabilityViewInterval = 5; //TODO: Interval config化？

    let cleaningTime = 0;
    let cleaningInterval = 0;
    let roomCleaning = [];

    // 清掃オプションを考慮する場合、清掃時間を無条件追加して、あとで引く方法をとっている。
    if (isConsiderCleaning) {
      cleaningTime = sails.config.visitors.cleaningMinute * 60 * 1000;
      cleaningInterval = cleaningTime / (availabilityViewInterval * 60 * 1000);
      roomCleaning = await Room.find({ cleaningOption: true }); // 清掃会議室の一覧取得
    }

    const schedules = await MSGraph.getSchedule(accessToken, email, {
      startTime: {
        dateTime: MSGraph.getGraphDateTime(startTimestamp),
        timeZone: MSGraph.getTimeZone(),
      },
      endTime: {
        dateTime: MSGraph.getGraphDateTime(endTimestamp + cleaningTime), // 清掃時間加算
        timeZone: MSGraph.getTimeZone(),
      },
      schedules: roomEmails,
      availabilityViewInterval: availabilityViewInterval.toString(),
      $select: "scheduleId,availabilityView",
    });

    // フリースペース会議室の一覧取得
    const freespaces = await Room.find({ type: "free" });

    return roomEmails.filter((email) => {
      // フリースペースの場合は重複可のため、空き時間判定は不要
      if (freespaces.find((free) => free.email === email)) {
        return true;
      }
      const schedule = schedules.find((sc) => sc.scheduleId === email);

      // 清掃オプションを考慮する場合
      if (isConsiderCleaning) {
        // 清掃不要会議室の場合、空き時間判定のendを縮める
        // 会議室設定の清掃オプションはフィールド自体存在しない場合があるのでtrueで絞り込んだ配列を利用
        if (roomCleaning.every((cleaning) => cleaning.email !== email)) {
          schedule.availabilityView = schedule.availabilityView.slice(
            0,
            -1 * cleaningInterval
          );
        }
      }

      const viewArray = schedule.availabilityView.match(/.{1}/g);
      return viewArray.every(($) => $ === "0");
    });
  },

  getCalendarEvents: (
    accessToken,
    email,
    conditions = {
      startDateTime: moment().startOf("date").add(1, "s").format(),
      endDateTime: moment().endOf("date").format(),
      $orderBy: "start/dateTime",
      $select: visitorsSelecter,
    }
  ) => {
    return MSGraph.requestCalendarView(accessToken, email, conditions);
  },

  requestCalendarView: async (
    accessToken,
    email,
    conditions,
    options = {
      method: "GET",
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    }
  ) => {
    const path = "calendar/calendarView";

    if (!!conditions) {
      options.params = conditions;
    }

    return await MSGraph.getDataValues(accessToken, email, path, options);
  },

  postEvent: async (accessToken, email, params) => {
    const path = "events";
    const data = {
      ...params,
    };
    const $ = await MSGraph.request(accessToken, email, path, {
      method: "POST",
      data: data,
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    });
    return $.data;
  },

  patchEvent: async (accessToken, email, eventId, params) => {
    const path = `events/${eventId}`;
    const data = {
      ...params,
    };
    const $ = await MSGraph.request(accessToken, email, path, {
      method: "PATCH",
      data: data,
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    });
    return $.data;
  },

  deleteEvent: async (accessToken, email, eventId) => {
    const path = `events/${eventId}`;
    const $ = await MSGraph.request(accessToken, email, path, {
      method: "DELETE",
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    });
    return $.data || null;
  },

  getDataValues: async (accessToken, email, path, options) => {
    // リクエストとそのレスポンス
    const result = await MSGraph.request(accessToken, email, path, options);
    const body = result.data;

    // レスポンス中のデータ
    const first = !!body.value ? body.value : null;

    // レスポンス中に後続リンクがない場合はそのまま返す
    if (!body["@odata.nextLink"]) {
      return first;
    }

    // レスポンス中に後続リンクがある場合
    // リンク先を再帰呼び出しして次の(ページングされた)データリストを取得。
    // レスポンス中データに追加して返す
    const nextOpt = _.chain(options)
      .omit(["url", "params"]) // 項目を除去
      .extend({ url: body["@odata.nextLink"] }) // URLを追加
      .value();
    const next = await MSGraph.getDataValues(accessToken, email, path, nextOpt);
    return first.concat(next);
  },

  request: async (accessToken, email, path, options) => {
    try {
      const _options = {
        ...options,
        url: options.url || `${baseUrl}/${email}/${path}`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accepts: "application/json",
          "Content-Type": "application/json; charset=utf-8",
          // Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
          ...options.headers,
        },
      };
      sails.log.info(_options);
      return await Http.request(_options);
    } catch (err) {
      if (err.response.data) {
        sails.log.error(err.response.data);
      }
      throw err;
    }
  },

  generateEventData: async (data, author) => {
    // 会議室の取得
    const roomId = Object.keys(data.resourcies)[0]; // TODO:複数会議室未対応
    const room = await Room.findOne(data.resourcies[roomId].roomForEdit);

    // 清掃オプション時間
    const cleaningTime = room.cleaningOption
      ? sails.config.visitors.cleaningMinute * 60 * 1000
      : 0;

    // 日時の設定
    const startTimestamp = new Date(data.startTime).getTime();
    const endTimestamp = new Date(data.endTime).getTime() + cleaningTime;

    // エラーチェック------
    const errors = {};
    if (!!Object.keys(errors).length) {
      return [{}, errors];
    }
    //------------------

    const attendees = Object.keys(data.mailto).reduce((newObj, type) => {
      newObj[type] = data.mailto[type].map((user) => {
        return {
          emailAddress: { name: user.name, address: user.address },
          type: type,
        };
      });
      return newObj;
    }, {});

    // attendees[0] = organizer
    const hiddenEmail = sails.config.visitors.isOwnerMode
      ? [sails.config.visitors.credential.username, author.email] // [代表アカウント, 予約者]
      : [author.email, sails.config.visitors.credential.username]; // [予約者, 代表アカウント]

    const categories = sails.config.visitors.isOwnerMode
      ? [
          MSGraph.getVisitorsLabel(), // プレーンラベルをセット
          MSGraph.getLocationLabel(room.location), // ロケーションIDをセット
          MSGraph.getCategoryLabel(room.category), // カテゴリIDをセット
          MSGraph.getRoomLabel(room.id), // 会議室IDをセット
          MSGraph.getAuthorLabel(author.email), // 予約者をセット
        ]
      : [];

    const location = await Location.findOne(room.location);
    const linkUrl = `${sails.config.appUrl}/${location.url}/`;

    let bodyHtml = `<br/>\r\n<div>\r\n`;
    bodyHtml += `■予約情報`;
    bodyHtml += `<br/>\r\n`;
    bodyHtml += `・予約者：${author.name}&lt;${author.email}&gt;`;
    bodyHtml += `<br/>\r\n`;
    bodyHtml += `------------------------------------------------------------`;
    bodyHtml += `<br/>\r\n`;
    // bodyHtml += `これは「LIVENESS Visitors for Microsoft」を使用して処理された予定です。以下リンクから起動できます。`;
    bodyHtml += `これは「Visitors」を使用して処理された予定です。以下リンクから起動できます。`;
    bodyHtml += `<br/>\r\n`;
    bodyHtml += `<a href='${linkUrl}'>${linkUrl}</a>\r\n`;
    bodyHtml += `</div>\r\n`;

    const event = {
      subject: data.subject,
      categories: categories,
      body: {
        contentType: "html",
        content: `<html>\r\n<head>\r\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\r\n</head>\r\n<body>\r\n${bodyHtml}</body>\r\n</html>\r\n`,
      },
      start: {
        dateTime: MSGraph.getGraphDateTime(startTimestamp),
        timeZone: MSGraph.getTimeZone(),
      },
      end: {
        dateTime: MSGraph.getGraphDateTime(endTimestamp),
        timeZone: MSGraph.getTimeZone(),
      },
      location: {
        displayName: room.name, // outlookのスケジュール表に表示される文字列
        locationType: "conferenceRoom",
        locationEmailAddress: room.email,
      },
      attendees: [
        {
          emailAddress: { address: hiddenEmail[0] }, // organizer
          type: "required",
        },
        {
          emailAddress: { address: hiddenEmail[1] }, // isOwnerMode? 予約者 : 管理者
          type: "required",
        },
        {
          emailAddress: { address: room.email }, // TODO:複数会議室未対応
          type: "resource", //リソース
        },
        ...attendees.required,
        ...attendees.optional,
      ],
    };

    // 定期イベントの場合
    if (!!data.recurrence) {
      // rangeオブジェクト作成
      const recurrenceRange = {
        type: data.recurrence.range.type,
        startDate: moment(
          new Date(data.recurrence.range.startDate).getTime()
        ).format("YYYY-MM-DD"),
        recurrenceTimeZone: MSGraph.getTimeZone(),
      };
      switch (data.recurrence.range.type) {
        case "endDate":
          recurrenceRange.endDate = moment(
            new Date(data.recurrence.range.endDate).getTime()
          ).format("YYYY-MM-DD");
          break;
        case "numbered":
          recurrenceRange.numberOfOccurrences =
            data.recurrence.numberOfOccurrences;
          break;
        // case "noEnd"://TODO: noEnd未対応（最大５年問題）
        //   break;
        default:
          break;
      }
      // recurrenceオブジェクト作成
      event.recurrence = {
        pattern: { ...data.recurrence.pattern },
        range: { ...recurrenceRange, type: data.recurrence.range.type },
      };
    }

    return [event, errors];
  },

  pickDirtyFields: (updateEvent, dirtyFields) => {
    const result = {};
    Object.keys(dirtyFields).forEach((key) => {
      switch (key) {
        case "subject":
          result["subject"] = updateEvent["subject"];
          break;
        case "startTime":
          result["start"] = { ...updateEvent["start"] };
          break;
        case "endTime":
          result["end"] = { ...updateEvent["end"] };
          break;
        case "mailto":
          result["attendees"] = _.cloneDeep(updateEvent["attendees"]);
          break;
        case "resourcies":
          const roomId = Object.keys(dirtyFields.resourcies)[0]; //TODO:複数会議室未対応
          if (!!dirtyFields.resourcies[roomId].roomForEdit) {
            result["location"] = { ...updateEvent["location"] };
            result["attendees"] = _.cloneDeep(updateEvent["attendees"]);
          }
          break;
        case "recurrence":
          if (!!updateEvent["recurrence"]) {
            result["recurrence"] = _.cloneDeep(updateEvent["recurrence"]);
          } else {
            result["recurrence"] = null; // 定期イベントの解除はnullをセット
          }

          break;
        default:
      }
    });
    return result;
  },

  // 指定した予約の会議室が空いているかチェック
  isAvailableRooms: async (
    isAdmin,
    accessToken,
    email,
    event,
    startDiff = null,
    endDiff = null
  ) => {
    const errors = {};
    const startTimestamp = new Date(event.start.dateTime).getTime();
    const endTimestamp = new Date(event.end.dateTime).getTime();
    const rooms = event.attendees.filter(($) => $.type === "resource");
    const room = await Room.findOne({ email: rooms[0].emailAddress.address }); // TODO:複数会議室未対応

    // 管理者以外は予約可能日数外の会議室予約は予約NG
    if (
      !isAdmin &&
      !(await sails.helpers.isWithinAvailableDays(room, new Date(endTimestamp)))
    ) {
      const dateErrCode = "visitdialog.form.error.reservation-period";
      errors.startTime = [dateErrCode];
      errors.endTime = [dateErrCode];
      return [false, errors]; //result NG
    }

    const start = startDiff ? startDiff : startTimestamp;
    const end = endDiff ? endDiff : endTimestamp;

    // graphAPIから空き会議室を取得
    const available = await MSGraph.getAvailableRooms(
      accessToken,
      email,
      start,
      end,
      [rooms[0].emailAddress.address] // TODO:複数会議室未対応
    );

    if (available.length === rooms.length) {
      return [true, errors]; //result OK
    } else {
      // TODO:複数会議室未対応
      // (どの会議室がNGだったか返していない。available配列を調べればOK)
      const dateErrCode = "visitdialog.form.error.available-time";
      errors.startTime = [dateErrCode];
      errors.endTime = [dateErrCode];
      return [false, errors]; //result NG
    }
  },

  getTimeZone: () => sails.config.visitors.timezone || "Asia/Tokyo",

  getTimestamp: (str) => new Date(str.substring(0, str.indexOf("."))).getTime(),

  getGraphDateTime: (timestamp) =>
    moment(timestamp).format("YYYY-MM-DD[T]HH:mm:ss"),

  getDateFormat: (str) => str.substring(0, str.indexOf("T")).replace(/-/g, "/"),

  getTimeFormat: (str) =>
    str.substring(str.indexOf("T") + 1, str.lastIndexOf(":")),

  getVisitorsLabel: () => `${labelTitle}.`,
  getLocationLabel: (id) => `${labelTitle}locationId is ${id}.`,
  getCategoryLabel: (id) => `${labelTitle}categoryId is ${id}.`,
  getRoomLabel: (id) => `${labelTitle}roomId is ${id}.`,
  getAuthorLabel: (email) => `${labelTitle}Created by ${email}.`,

  // イベントのLocationから会議室のみを抽出=> 必要情報を纏めて再定義
  reduceLocations: async (event) => {
    return await reduce(
      event.locations,
      async (result, current) => {
        if (current.hasOwnProperty("locationUri")) {
          const room = await Room.findOne({
            email: current.locationUri,
            // location: location.id,
            // ↑ MS側からの登録の場合、visitorのロケーションを跨いて予約できるので絞り込まずに取得(コメントアウト)
          });
          if (!!room) {
            // 会議室のステータスを取得
            const attendee = event.attendees.find(
              (value) =>
                value.type === "resource" &&
                value.hasOwnProperty("emailAddress") &&
                value.emailAddress.address === room.email
            );
            const status = attendee ? attendee.status.response : "";

            // 会議室IDをkeyとして再定義
            result[room.id] = { ...current, status: status };
          }
        }
        return result;
      },
      {}
    );
  },
};

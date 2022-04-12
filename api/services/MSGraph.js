const moment = require("moment-timezone");
const { reduce } = require("p-iteration");

const baseUrl = "https://graph.microsoft.com/v1.0/users";

module.exports = {
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
    const path = "calendar/getSchedule";
    const options = {
      method: "POST",
      data: data,
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    };
    const result = await MSGraph.request(accessToken, email, path, options);
    return result.data.value;
  },

  getCalendarEvents: (
    accessToken,
    email,
    conditions = {
      startDateTime: moment().startOf("date").add(1, "s").format(),
      endDateTime: moment().endOf("date").format(),
      $orderBy: "start/dateTime",
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

    // リクエストとそのレスポンス
    const result = await MSGraph.request(accessToken, email, path, options);
    // return result.data;
    const body = result.data;

    // レスポンス中のイベント
    const first = !!body.value ? body.value : null;

    // レスポンス中に後続リンクがない場合はそのまま返す
    if (!body["@odata.nextLink"]) {
      return first;
    }

    // レスポンス中に後続リンクがある場合
    // リンク先を再帰呼び出しして次の(ページングされた)イベントリストを取得。
    // レスポンス中イベントに追加して返す
    const nextOpt = _.chain(options)
      .omit(["url", "params"]) // 項目を除去
      .extend({ url: body["@odata.nextLink"] }) // URLを追加
      .value();
    const next = await MSGraph.requestCalendarView(
      accessToken,
      email,
      null,
      nextOpt
    );
    return first.concat(next);
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

  generateEventData: async (data, userEmail) => {
    // 会議室の取得
    const roomId = Object.keys(data.resourcies)[0]; // TODO:複数会議室未対応
    const room = await Room.findOne(data.resourcies[roomId].roomForEdit);

    // 日時の設定
    const startTimestamp = new Date(data.startTime).getTime();
    const endTimestamp = new Date(data.endTime).getTime();

    const errors = {};
    // イベント日時の関係性チェック
    if (startTimestamp >= endTimestamp) {
      const dateErrCode = "visitdialog.form.error.event-time";
      errors.startTime = [dateErrCode];
      errors.endTime = [dateErrCode];
    }
    if (!!Object.keys(errors).length) {
      return [{}, errors];
    }

    const event = {
      subject: data.subject,
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
          emailAddress: { address: userEmail }, // TODO: フロントユーザーが後から変更かけた場合、この値が変更される可能性あり。要調査
          type: "required",
        },
        {
          emailAddress: { address: room.email },
          type: "resource", //リソース
        },
      ],
    };
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
        case "resourcies":
          const roomId = Object.keys(dirtyFields.resourcies)[0]; //TODO:複数会議室未対応
          if (!!dirtyFields.resourcies[roomId].roomForEdit) {
            result["location"] = { ...updateEvent["location"] };
            result["attendees"] = _.cloneDeep(updateEvent["attendees"]);
          }
          break;
        default:
      }
    });
    return result;
  },

  getTimeZone: () => sails.config.visitors.timezone || "Asia/Tokyo",

  getTimestamp: (str) => new Date(str.substring(0, str.indexOf("."))).getTime(),

  getGraphDateTime: (timestamp) =>
    moment(timestamp).format("YYYY-MM-DD[T]HH:mm:ss"),

  getDateFormat: (str) => str.substring(0, str.indexOf("T")).replace(/-/g, "/"),

  getTimeFormat: (str) =>
    str.substring(str.indexOf("T") + 1, str.lastIndexOf(":")),

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

const moment = require("moment-timezone");

const baseUrl = "https://graph.microsoft.com/v1.0/users";

module.exports = {
  getCalendarEvents: (
    accessToken,
    email,
    conditions = {
      startDateTime: moment().startOf("date").add(1, "s").format(),
      endDateTime: moment().endOf("date").format(),
      orderBy: "start/dateTime",
    }
  ) => {
    // sails.log('conditions', conditions);
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
    // オープン拡張機能の取得が出来るようにcalendarView→eventsに変更
    // const path = "calendar/calendarView";
    const path = "calendar/events";

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

  getTimeZone: () => sails.config.visitors.timezone || "Asia/Tokyo",

  getGraphDateTime: (timestamp) =>
    moment(timestamp).format("YYYY-MM-DD[T]HH:mm:ss"),

  getTimeFormat: (str) =>
    str.substring(str.indexOf("T") + 1, str.lastIndexOf(":")),
};

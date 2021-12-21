const moment = require("moment-timezone");
const { from, concat } = require("rxjs");
const { share, map, filter, concatMap } = require("rxjs/operators");

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

  analyze: (accessToken, email, queries) => {
    return MSGraph.requestAnalysis(accessToken, email, queries);
  },

  postEvent: async (accessToken, email, params) => {
    const path = "events";
    const data = {
      ...params,
      // start: MSGraph.unixToDttz(params.start),
      // end: MSGraph.unixToDttz(params.end),
    };

    const $ = await MSGraph.request(accessToken, email, path, {
      method: "POST",
      data: data,
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    });
    return $.data;
    // return MSGraph.request(
    //   accessToken,
    //   email,
    //   path,
    //   {
    //     method: 'POST',
    //     data: data,
    //     headers: {
    //       Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`
    //     },
    //   },
    // ).pipe(
    //   map($ => $.data),
    // );
  },

  patchEvent: (accessToken, email, eventId, params) => {
    const path = `events/${eventId}`;
    const data = {
      ...params,
    };

    return MSGraph.request(accessToken, email, path, {
      method: "PATCH",
      data: data,
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    }).pipe(map(($) => $.data));
  },

  deleteEvent: (accessToken, email, eventId) => {
    const path = `events/${eventId}`;

    return MSGraph.request(accessToken, email, path, {
      method: "DELETE",
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    }).pipe(map(($) => $.data || null));
  },

  getUsers: (accessToken, queries) => {
    // const path = 'events';
    // const data = {
    // };

    return MSGraph.request(accessToken, null, null, {
      method: "GET",
      // url: `${baseUrl}?$search=${encodeURIComponent('"userPrincipalName:k.akamatsu@liveness.co.jp"')}&$select=displayName,department,userPrincipalName`,
      url: baseUrl,
      // data: data,
      headers: {
        ConsistencyLevel: "eventual",
      },
      params: queries,
    }).pipe(map(($) => $.data));
  },

  send: (accessToken, body) => {
    return MSGraph.request(accessToken, null, null, {
      method: "POST",
      url: `${baseUrl.replace("users", "me")}/sendMail`,
      data: { message: body },
    }).pipe(map(($) => $.data));
  },

  requestCalendarView: (
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

    // リクエストとそのレスポンス(ホットオブザーバブル)
    const result = MSGraph.request(accessToken, email, path, options).pipe(
      filter(($) => !!$.data),
      map(($) => $.data),
      share()
    );

    // レスポンス中のイベント
    const first = result.pipe(
      filter((body) => !!body.value),
      map((body) => body.value),
      // tap(($) => sails.log.info('value', $)),
      concatMap((list) => from(list))
    );

    // レスポンス中のリンクから次の(ページングされた)イベントリストを取得
    const next = result.pipe(
      filter((body) => !!body["@odata.nextLink"]),
      map((body) => body["@odata.nextLink"]),
      filter((nextLink) => !!nextLink),
      concatMap((nextLink) => {
        // リンク先を再帰呼び出し
        const nextOpt = _.chain(options)
          .omit(["url", "params"]) // 項目を除去
          .extend({ url: nextLink }) // URLを追加
          .value();
        console.log("nextOpt", nextOpt);
        return MSGraph.requestCalendarView(accessToken, email, null, nextOpt);
      })
    );

    // イベントを先に、次ページのイベントを後に流す。
    return concat(first, next);
  },

  requestAnalysis: (
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

    // リクエストとそのレスポンス(ホットオブザーバブル)
    const result = MSGraph.request(accessToken, email, path, options).pipe(
      filter(($) => !!$.data),
      map(($) => $.data),
      share()
    );

    // レスポンス中のイベント
    const first = result.pipe(
      filter((body) => !!body.value),
      map((body) => body.value),
      // tap(($) => sails.log.info('value', $)),
      concatMap((list) => from(list))
    );

    // レスポンス中のリンクから次の(ページングされた)イベントリストを取得
    const next = result.pipe(
      filter((body) => !!body["@odata.nextLink"]),
      map((body) => body["@odata.nextLink"]),
      filter((nextLink) => !!nextLink),
      concatMap((nextLink) => {
        // リンク先を再帰呼び出し
        const nextOpt = _.chain(options)
          .omit(["url", "params"]) // 項目を除去
          .extend({ url: nextLink }) // URLを追加
          .value();
        console.log("nextOpt", nextOpt);
        return MSGraph.requestAnalysis(accessToken, email, null, nextOpt);
      })
    );

    // イベントを先に、次ページのイベントを後に流す。
    return concat(first, next);
  },

  getToken: () => {
    return OAuth2.getValidToken().pipe(
      // tap((room) => sails.log.info('Room', room)),
      map((token) => ({ token: token }))
    );
  },

  getTokenAndEmail: (req) => {
    const roomId = req.param("roomid");
    return from(Room.findOne(roomId)).pipe(
      // tap((room) => sails.log.info('Room', room)),
      map((room) => room.email),
      concatMap((email) =>
        OAuth2.getValidToken().pipe(
          // tap((token) => sails.log.info('Token', token)),
          map((token) => ({ token: token, email: email }))
        )
      )
    );
  },

  // // callGraph: (accessToken, options) => {
  request: async (accessToken, email, path, options) => {
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
    // return Http.request(_options).pipe(
    //   // tap(($) => sails.log.info('Response', $)),
    // );
  },

  // // callGraphBase: (accessToken, options, baseUrl) => {
  // httpRequest: (accessToken, options, baseUrl) => {
  //   const _baseUrl = (baseUrl || 'https://graph.microsoft.com/v1.0')
  //     .replace(/\/$/, '');
  //   const _options = {
  //     method: options.method || 'GET',
  //     url: options.url || `${_baseUrl}/${options.path.replace(/^\//, '')}`,
  //     headers: {
  //       ...options.headers,
  //       Accepts: 'application/json',
  //       'Content-Type': 'application/json',
  //     },
  //     auth: { bearer: accessToken },
  //     data: options.data,
  //   };
  //   return Http.request(_options);
  // },

  getTimeZone: () => sails.config.rooms.timezone || "Asia/Tokyo",

  unixToDttz: (unix) => ({
    dateTime: moment(unix).format().slice(0, 19),
    timeZone: MSGraph.getTimeZone(),
  }),
};

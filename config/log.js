/**
 * Built-in Log Configuration
 * (sails.config.log)
 *
 * Configure the log level for your app, as well as the transport
 * (Underneath the covers, Sails uses Winston for logging, which
 * allows for some pretty neat custom transports/adapters for log messages)
 *
 * For more information on the Sails logger, check out:
 * https://sailsjs.com/docs/concepts/logging
 */

const { createLogger, format, transports } = require("winston");
const { version } = require("../package.json");
const { SPLAT } = require("triple-beam");
const { isObject } = require("@sailshq/lodash");
const moment = require("moment-timezone");

const logLevel = "info";
const sailsLogLevels = {
  error: 0,
  warn: 1,
  debug: 2,
  info: 3,
  verbose: 4,
  silly: 5,
};

function formatObject(param) {
  try {
    if (isObject(param)) {
      return JSON.stringify(param);
    }
    return param;
  } catch (e) {
    return "";
  }
}

const all = format((info) => {
  const splat = info[SPLAT] || [];
  const message = formatObject(info.message);
  const rest = splat.map(formatObject).join(" ");
  info.message = `${message} ${rest}`;
  return info;
});

const localTimeStamp = () => {
  return moment().format("YYYY/MM/DD HH:mm:ss.SSS");
};

const customLogger = createLogger({
  // format: format.combine(
  //   all(),
  //   format.label({ label: version }),
  //   format.timestamp(),
  //   format.colorize(),
  //   format.align(),
  //   format.printf(info => `${info.timestamp} [${info.label}] ${info.level}: ${formatObject(info.message)}`),
  // ),
  level: logLevel,
  levels: sailsLogLevels,
  transports: [
    new transports.Console({
      format: format.combine(
        all(),
        format.label({ label: version }),
        format.timestamp({ format: localTimeStamp }),
        format.colorize(),
        format.align(),
        format.printf(
          (info) =>
            `${info.timestamp} [${info.label}] ${info.level}: ${formatObject(
              info.message
            )}`
        )
      ),
    }),
    new transports.File({
      filename: "visitors.log",
      maxsize: 1024 * 1024,
      maxFiles: 9,
      format: format.combine(
        all(),
        format.label({ label: version }),
        format.timestamp({ format: localTimeStamp }),
        format.printf(
          (info) =>
            `${info.timestamp} [${info.label}] ${info.level}: ${formatObject(
              info.message
            )}`
        )
      ),
    }),
  ],
});

module.exports.log = {
  /***************************************************************************
   *                                                                          *
   * Valid `level` configs: i.e. the minimum log level to capture with        *
   * sails.log.*()                                                            *
   *                                                                          *
   * The order of precedence for log levels from lowest to highest is:        *
   * silly, verbose, info, debug, warn, error                                 *
   *                                                                          *
   * You may also set the level to "silent" to suppress all logs.             *
   *                                                                          *
   ***************************************************************************/
  custom: customLogger,
  inspect: false,
  level: logLevel,
};

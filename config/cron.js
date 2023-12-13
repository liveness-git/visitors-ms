// ['seconds', 'minutes', 'hours', 'dayOfMonth', 'month', 'dayOfWeek']

module.exports.cron = {
  resetJob: {
    schedule: "0 0 2 * * *", // 毎日AM2:00に実行
    onTick: async () => {
      try {
        await CronJobs.saveEvents();
      } catch (err) {
        sails.log.error("cron.resetJob(): ", err.message);
      }
    },
  },
  patchJob: {
    schedule: "0 */10 * * * *", // 10分毎に実行
    onTick: async () => {
      try {
        sails.log.debug("patchJob");
      } catch (err) {
        sails.log.error("cron.patchJob(): ", err.message);
      }
    },
  },
  trackingJob: {
    schedule: "*/10 * * * * *", // 10秒毎に実行
    onTick: async () => {
      try {
        await CronJobs.tracking();
      } catch (err) {
        sails.log.error("cron.trackingJob(): ", err.message);
      }
    },
  },
};

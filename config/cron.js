// ['seconds', 'minutes', 'hours', 'dayOfMonth', 'month', 'dayOfWeek']

module.exports.cron = {
  resetJob: {
    // schedule: sails.config.visitors.cron.resetJob.schedule,
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
    // schedule: sails.config.visitors.cron.patchJob.schedule,
    schedule: "0 5,15,25,35,45,55 * * * *", // 各時x5分に実行
    onTick: async () => {
      try {
        /**
         * feature-0.0.1.0
         * キャッシュの更新ジョブを実行する。
         */
        await CronJobs.patchJob();
      } catch (err) {
        sails.log.error("cron.patchJob(): ", err.message);
      }
    },
    // start: false,
  },
  trackingJob: {
    // schedule: sails.config.visitors.cron.trackingJob.schedule,
    schedule: "*/10 * * * * *", // 10秒毎に実行
    onTick: async () => {
      try {
        await CronJobs.tracking();
      } catch (err) {
        sails.log.error("cron.trackingJob(): ", err.message);
      }
    },
    // start: false,
  },
};

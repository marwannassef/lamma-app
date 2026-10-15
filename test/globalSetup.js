// Fixed time zone so date/time tests behave the same on every machine and in CI.
module.exports = () => {
  process.env.TZ = 'Africa/Cairo';
};

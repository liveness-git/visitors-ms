module.exports = async function (req, res, proceed) {
  return !req.session.user ? res.forbidden() : proceed();
};

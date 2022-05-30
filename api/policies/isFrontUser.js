module.exports = async function (req, res, proceed) {
  return !!req.session.user && req.session.user.isFront
    ? proceed()
    : res.forbidden();
};

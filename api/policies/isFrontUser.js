module.exports = async function (req, res, proceed) {
  return !!req.session.user &&
    (req.session.user.isFront || req.session.user.isAdmin)
    ? proceed()
    : res.forbidden();
};

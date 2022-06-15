/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes tell Sails what to do each time it receives a request.
 *
 * For more information on configuring custom routes, check out:
 * https://sailsjs.com/anatomy/config/routes-js
 */
const path = require("path");
const resolver = (req, res) => {
  res.sendFile(path.join(__dirname, "..", "assets", "index.html"));
};

module.exports.routes = {
  /***************************************************************************
   *                                                                          *
   * Make the view located at `views/homepage.ejs` your home page.            *
   *                                                                          *
   * (Alternatively, remove this and add an `index.html` file in your         *
   * `assets` directory)                                                      *
   *                                                                          *
   ***************************************************************************/
  // '/': { view: 'pages/homepage' },
  /***************************************************************************
   *                                                                          *
   * More custom routes here...                                               *
   * (See https://sailsjs.com/config/routes for examples.)                    *
   *                                                                          *
   * If a request to a URL doesn't match any of the routes in this file, it   *
   * is matched against "shadow routes" (e.g. blueprint routes).  If it does  *
   * not match any of those, it is matched against static assets.             *
   *                                                                          *
   ***************************************************************************/
  // frontend
  "GET /:location?/login": resolver,
  "GET /:location/main/byroom": resolver,
  "GET /:location/main": resolver,
  "GET /:location/front": resolver,
  "GET /:location/settings/*": resolver,
  // msOAuth
  "GET /oauth/signin": "OauthController.signin",
  "GET /oauth/redirect": resolver,
  "GET /oauth/callback": "OauthController.redirect",
  "GET /oauth/signout": "OauthController.signout",
  // backend
  "GET /user/me": "UserController.me",
  "GET /user/addressbook": "UserController.addressbook",
  "GET /room/choices": "RoomController.choices",
  "GET /location/choices": "LocationController.choices",
  "GET /location/first": "LocationController.first",
  "GET /category/choices": "CategoryController.choices",
  "GET /front/visitlist": "FrontController.visitList",
  "GET /event/visitlist": "EventController.visitList",
  "GET /event/byroom": "EventController.byRoom",
  "POST /front/checkin": "FrontController.checkin",
  "POST /front/checkout": "FrontController.checkout",
  "POST /event/create": "EventController.create",
  "POST /event/delete": "EventController.delete",
  "POST /visitor/create": "VisitorController.create",
  "POST /visitor/update": "VisitorController.update",
  "POST /visitor/delete": "VisitorController.delete",
  // backend master
  "GET /role/list": "RoleController.list",
  "POST /role/create": "RoleController.create",
  "POST /role/update": "RoleController.update",
  "POST /role/delete": "RoleController.delete",
  "GET /room/list": "RoomController.list",
  "POST /room/create": "RoomController.create",
  "POST /room/update": "RoomController.update",
  "POST /room/delete": "RoomController.delete",
  "GET /location/list": "LocationController.list",
  "POST /location/create": "LocationController.create",
  "POST /location/update": "LocationController.update",
  "POST /location/delete": "LocationController.delete",
  "GET /category/list": "CategoryController.list",
  "POST /category/create": "CategoryController.create",
  "POST /category/update": "CategoryController.update",
  "POST /category/delete": "CategoryController.delete",

  // default
  "GET /": resolver,
};

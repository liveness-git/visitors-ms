/**
 * Policy Mappings
 * (sails.config.policies)
 *
 * Policies are simple functions which run **before** your actions.
 *
 * For more information on configuring policies, check out:
 * https://sailsjs.com/docs/concepts/policies
 */

module.exports.policies = {
  /***************************************************************************
   *                                                                          *
   * Default policy for all controllers and actions, unless overridden.       *
   * (`true` allows public access)                                            *
   *                                                                          *
   ***************************************************************************/

  // '*': true,
  UserController: {
    "*": "isUserSignedIn",
  },
  RoleController: {
    "*": "isUserSignedIn",
    list: "isAdminUser",
    create: "isAdminUser",
    update: "isAdminUser",
    delete: "isAdminUser",
  },
  RoomController: {
    "*": "isUserSignedIn",
    list: "isAdminUser",
    create: "isAdminUser",
    update: "isAdminUser",
    delete: "isAdminUser",
  },
  EventController: {
    "*": "isUserSignedIn",
  },
  VisitorController: {
    "*": "isUserSignedIn",
  },
  LocationController: {
    "*": "isUserSignedIn",
    list: "isAdminUser",
    create: "isAdminUser",
    update: "isAdminUser",
    delete: "isAdminUser",
  },
  CategoryController: {
    "*": "isUserSignedIn",
    list: "isAdminUser",
    create: "isAdminUser",
    update: "isAdminUser",
    delete: "isAdminUser",
  },
  FrontController: {
    "*": "isFrontUser",
  },
};

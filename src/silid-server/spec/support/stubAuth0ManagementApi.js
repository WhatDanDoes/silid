/**
 * Stub all the Auth0 Management API endpoints used on login
 *
 * @param function
 */
const apiScope = require('../../config/apiPermissions');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubRolesRead = require('../support/auth0Endpoints/stubRolesRead');
const stubUserAssignRoles = require('../support/auth0Endpoints/stubUserAssignRoles');
const stubUserRolesRead = require('../support/auth0Endpoints/stubUserRolesRead');

/**
 * Stuff that happens on every logon
 *
 * @params object
 * @params function
 */
module.exports = function(options, done) {

  if (typeof options === 'function') {
    done = options;
    options = {};
  }

  let userReadScope, getRolesScope, userAssignRolesScope;

  /**
   * This layer stubs the endpoints required for the retrieving the agent's
   * OIDC profile data on login
   */
  stubUserRead(options.userRead ? options.userRead : undefined, (err, apiScopes) => {
    if (err) return done(err);
    ({userReadScope} = apiScopes);

    /**
     * The following two layers stub the endpoints required for the
     * `viewer` role-check in `lib/checkPermissions`
     */
    stubRolesRead((err, apiScopes) => {
      if (err) return done(err);
      ({rolesReadScope} = apiScopes);

      /**
       * If basic `viewer` permissions are not assigned (they won't be on
       * initial login), assign the agent the `viewer role
       */
      stubUserAssignRoles((err, apiScopes) => {
        if (err) return done(err);
        ({userAssignRolesScope} = apiScopes);

        stubUserRolesRead(options.userRoles ? options.userRoles : undefined, (err, apiScopes) => {
          if (err) return done(err);
          ({userRolesReadScope} = apiScopes);

          /**
           * This satisfies the call in `checkPermissions` that takes place in
           * the case of an unknown agent or a profile change
           */
          stubUserRead(options.userRead ? options.userRead : undefined, (err, apiScopes) => {
            if (err) return done(err);

            done(null, {userReadScope, rolesReadScope, userAssignRolesScope, userRolesReadScope});
          });
        });
      });
    });
  });
};

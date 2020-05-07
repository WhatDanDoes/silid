/**
 * Stub all the Auth0 Management API endpoints used on login
 *
 * @param function
 */
const apiScope = require('../../config/apiPermissions');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubRolesRead = require('../support/auth0Endpoints/stubRolesRead');
const stubUserAssignRoles = require('../support/auth0Endpoints/stubUserAssignRoles');

module.exports = function(done) {

  let userReadScope, getRolesScope, userAssignRolesScope;

  /**
   * This layer stubs the endpoints required for the retrieving the agent's
   * OIDC profile data on login
   */
  stubUserRead((err, apiScopes) => {
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

        done(null, {userReadScope, rolesReadScope, userAssignRolesScope});
      });
    });
  });
};

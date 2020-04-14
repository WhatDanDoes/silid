/**
 * Stub all the commonly used Auth0 Management API endpoints
 *
 * The real functionality is embodied in `stubAuth0ManagementEndpoint` This
 * function simply wraps frequent stubbing requirements
 *
 * @param function
 */
const apiScope = require('../../config/apiPermissions');
const stubAuth0ManagementEndpoint = require('../support/stubAuth0ManagementEndpoint');

module.exports = function(done) {

  let auth0GetRolesScope, auth0UserAssignRolesScope, oauthTokenScope;

  /**
   * The top two layers account stub the endpoints required for the `viewer`
   * role check in `lib/checkPermissions`
   */
  stubAuth0ManagementEndpoint([apiScope.read.roles], (err, apiScopes) => {
    if (err) return done(err);
    ({getRolesScope} = apiScopes);

    stubAuth0ManagementEndpoint([apiScope.read.roles, apiScope.update.users], (err, apiScopes) => {
      if (err) return done(err);
      ({userAssignRolesScope, oauthTokenScope} = apiScopes);

      done(null, {getRolesScope, userAssignRolesScope, oauthTokenScope});
    });
  });
};

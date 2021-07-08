const nock = require('nock');
const apiScope = require('../../../config/apiPermissions');
const stubOauthToken =  require('./stubOauthToken');

/**
 * This stubs the Auth0 endpoint that creates a new agent
 *
 * @param object
 * @param function
 * @param object
 */
module.exports = function(done) {

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.create.users], (err, oauthScopes) => {
      if (err) return done(err);

      const {accessToken, oauthTokenScope: userCreateOauthTokenScope} = oauthScopes;

      /**
       * POST `/users`
       *
       * Auth0 requires a connection for this endpoint. It is called `Initial-Connection`
       * here. This setting can be configured at:
       *
       * https://manage.auth0.com/dashboard/us/silid/connections
       */
      const userCreateScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .post(/api\/v2\/users/, {
                                'email': /.+/i,
                                'connection': 'Initial-Connection',
                              })
        .reply(201, {
          "user_id": "auth0|507f1f77bcf86c0000000000",
          "email": "doesnotreallymatterforthemoment@example.com",
          "email_verified": false,
          "identities": [
            {
              "connection": "Initial-Connection",
            }
          ]
        });

      done(null, {userCreateScope, userCreateOauthTokenScope});

    });
  });
};

const nock = require('nock');
const querystring = require('querystring');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 *
 * For the moment, it doesn't seem to matter that all authenticated
 * agents are using the same access token for testing purposes.
 */
const _access = require('../fixtures/sample-auth0-access-token');
_access.iss = `http://${process.env.AUTH0_DOMAIN}/`;

const jwt = require('jsonwebtoken');

/**
 * Stub all the Auth0 Management API stuff. Used on a test-by-test basis to
 * provide and test against scoped permissions. Ensure the API is being called
 * when appropriate and likewise _not_ being called when appropriate
 *
 * @param array
 * @param function
 */
module.exports = function(permissions, done) {

  require('./setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    /**
     * A new agent needs some basic permissions. This endpoint is called
     * when `silid-server` needs permission to set these permissions
     */
    let accessToken = jwt.sign({..._access, scope: permissions},
                               prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
    const oauthTokenScope = nock(`https://${process.env.AUTH0_DOMAIN}`)
      .log(console.log)
      .post(/oauth\/token/, {
                              'grant_type': 'client_credentials',
                              'client_id': process.env.AUTH0_CLIENT_ID,
                              'client_secret': process.env.AUTH0_CLIENT_SECRET,
                              'audience': `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
                              'scope': permissions.join(' ')
                            })
      .reply(200, {
        'access_token': accessToken,
        'token_type': 'Bearer',
      });

    /**
     * GET `/users`
     */
    const userListScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .get(/api\/v2\/users/)
      .query({ per_page: 30, include_totals: true, page: /\d+/ })
      .reply(200, (uri, requestBody, cb) => {
        let q = querystring.parse(uri.split('?')[1]);
        cb(null, {...require('../fixtures/managementApi/userList'), start: parseInt(q.page) });
      });

    /**
     * POST `/users`
     *
     * Auth0 requires a connection for this endpoint. It is called `Initial-Connection`
     * here. This setting can be configured at:
     *
     * https://manage.auth0.com/dashboard/us/silid/connections
     */
    const userCreateScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
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

    /**
     * Create a team
     *
     * PATCH `/users`
     */
    const createTeamScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .patch(/api\/v2\/users\/*/, body => body.id && body.user_metadata)
      .reply(201, {});

    /**
     * DELETE `/users`
     *
     */
    const userDeleteScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .delete(/api\/v2\/users\/*/)
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

    /**
     * GET `/users-by-email`
     */
    const userReadByEmailScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .get(/api\/v2\/users-by-email/)
      .query({ 'email': /.+/i })
      .reply(200, {
        "user_id": "auth0|507f1f77bcf86c0000000000",
        "email": "doesnotreallymatterforthemoment@example.com",
        "email_verified": false,
        "identities": [
          {
            "connection": "Initial-Connection",
          }
        ]
      });

    /**
     * GET `/users`. Get a single user by Auth0 ID
     */
    const userReadScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .get(/api\/v2\/users\/*/)
      .reply(200, {
        "user_id": "auth0|507f1f77bcf86c0000000000",
        "email": "doesnotreallymatterforthemoment@example.com",
        "email_verified": false,
        "identities": [
          {
            "connection": "Initial-Connection",
          }
        ]
      });


    /**
     * GET `/users/:id/roles`
     */
    const userAssignRolesScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .post(/api\/v2\/users\/.+\/roles/, {
                              'roles': /.+/i,
      })
      .reply(200, { });

    /**
     * GET `/roles`
     */
    const getRolesScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .get('/api/v2/roles')
      .reply(200, [
        {
          "id": "123",
          "name": "viewer",
          "description": "View all roles"
        }
      ]);


    done(null, {
                oauthTokenScope,
                userCreateScope, userReadScope, userDeleteScope, userListScope, userReadByEmailScope,
                userAssignRolesScope,
                getRolesScope,
                createTeamScope,
    });
  });
};

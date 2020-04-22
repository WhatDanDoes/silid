/**
 * Mock Auth0 server with RBAC for end-to-end tests.
 *
 * Trick the client and server into thinking they're actually talking to Auth0
 *
 * RBAC: Role-Based Access Control
 *
 * Cf., mockAuth0Server uses an opaque access_code. This mock server
 * provides an agent's scope in its access token.
 */
require('dotenv-flow').config();

const jwt = require('jsonwebtoken');
const pem = require('pem');
const crypto = require('crypto');

/**
 * This must match the config at Auth0
 */
const scope = require('../../config/permissions');

/**
 * To ensure the e2e tests are true to production, the database must
 * first be migrated (as opposed to synced).
 *
 * This is syncing:
 * ```
 *  const models =  require('../../models');
 *  models.sequelize.sync({force: true}).then(() => {
 *    console.log('Database synced');
 *  }).catch(err => {
 *    console.error(err);
 *  });
 * ```
 *
 * The following runs the migrations when the tests are started.
 */
const models =  require('../../models');

if (process.env.NODE_ENV === 'e2e') {
  const exec = require('child_process').execSync;

  models.sequelize.drop().then(() => {
    console.log('Database dropped');
    exec('npx sequelize-cli db:migrate', { stdio: 'inherit' });//, (err) => {
    console.log('Database migrated');
  }).catch(err => {
    console.error(err);
  });
}

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');
const _access = require('../fixtures/sample-auth0-access-token');
const _profile = require('../fixtures/sample-auth0-profile-response');

/**
 * The agent ID token "database"
 */
const _identityDb = {};

require('../support/setupKeystore').then(keyStuff => {
  let { pub, prv, keystore } = keyStuff;

  pem.createCertificate({ days: 1, selfSigned: true }, function (err, keys) {
    if (err) {
      throw err
    }

    const tlsOptions = {
      key: keys.serviceKey,
      cert: keys.certificate
    };

    /**
     * Fake Auth0 server
     */
    const Hapi = require('@hapi/hapi');

    const init = async () => {

      const server = Hapi.server({
        port: 3002,
        host: '0.0.0.0',
        tls: tlsOptions,
        routes: {
          cors: true
        }
      });

      await server.register({
        plugin: require('hapi-require-https'),
        options: {}
      })

      /**
       * Pass an ID token and scoped permissions for immediate reference during
       * `/authorize`.
       *
       * The authorize route takes a pseudo-random access code and nonce. These
       * are required to access and validate an ID token. The ID token
       * registered here is stored to be combined with those codes when the
       * `/authorize` endpoint is hit after the `/login` redirect. If a new
       * agent is being added, the login has to happen immediately after in
       * the tests for the new agent to be added to the "database".
       */

      // Ensures every agent has a unique `user_id`
      let subIndex = 0;

      let _agentIdToken, _permissions;
      server.route({
        method: 'POST',
        path: '/register',
        handler: async function(request, h) {
          console.log('/register');
          console.log(request.payload);


          /**
           * Add agent to the _Auth0 database_
           */

          // Has this agent already been registed?
          let agent = await models.Agent.findOne({ where: {email: request.payload.token.email}});
          console.log('AGENT');
          console.log(agent);

          //let socialProfile = { ..._profile, ...request.payload.token, _json: { ..._profile, ...request.payload.token, sub: userId }, user_id: userId };
          let socialProfile = { ..._profile, ...request.payload.token, _json: { ..._profile, ...request.payload.token } };
          if (agent) {
            console.log('Agent found. Updating...');

            socialProfile._json.sub = agent.socialProfile.user_id;
            socialProfile.user_id = agent.socialProfile.user_id;
            agent.socialProfile = socialProfile;
            await agent.save();
          }
          else {
            console.log('No agent found. Creating...');
            let userId = request.payload.token.sub + ++subIndex;
            socialProfile._json.sub = userId;
            delete socialProfile._json.user_id;
            socialProfile.user_id = userId;
            delete socialProfile.sub;

            agent = await models.Agent.create({
              email: request.payload.token.email,
              socialProfile: socialProfile
            });
          }

          _agentIdToken = {...request.payload.token,
                             aud: process.env.AUTH0_CLIENT_ID,
                             sub: agent.socialProfile.user_id,
                             iss: `https://${process.env.AUTH0_DOMAIN}/`,
                             iat: Math.floor(Date.now() / 1000) - (60 * 60)};

          console.log('_agentIdToken');
          _permissions = request.payload.permissions.length ? request.payload.permissions : [];

          console.log(_agentIdToken);
          console.log(_permissions);

          return h.response(_agentIdToken);
        }
      });

      /**
       * Hit immediately after `/login`. If a new test agent has been
       * registered, he is added to the database here.
       */
      let _nonce;
      server.route({
        method: 'GET',
        path: '/authorize',
        handler: (request, h) => {
          console.log('/authorize');
          console.log(request.state);
          console.log(request.query);

          _nonce = request.query.nonce;
          const buffer = crypto.randomBytes(12);

          if (!_permissions) {
            _permissions = [scope.read.agents, scope.read.organizations];
          }
          const signedAccessToken = jwt.sign({..._access, permissions: _permissions}, prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } });

          // A test agent has been registered.
          if (_agentIdToken) {

            // Has this agent already been registered?
            // Update
            for (let code in _identityDb) {
              if (_identityDb[code].idToken.email === _agentIdToken.email) {
                delete _identityDb[code];
              }
            }

            // Register agent if no auth code found
            const idToken = { ..._agentIdToken, nonce: _nonce };
            const signedToken = jwt.sign(idToken, prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } });

            _identityDb[signedAccessToken] = { idToken: idToken,
                                               signedToken: signedToken,
                                               signedAccessToken: signedAccessToken };

            // This allows the next test to register an agent
            _agentIdToken = undefined;
            _permissions = undefined;
          }

          const redirectUrl= `${process.env.SERVER_DOMAIN}/callback?code=${signedAccessToken}&state=${request.query.state}`;
          console.log(`Redirecting: ${redirectUrl}`);

          return h.redirect(redirectUrl);
        }
      });

      /**
       * It's here that you kind of start to understand and appreciate OAuth...
       *
       * From here, the server calls `/userinfo`
       */
      server.route({
        method: 'POST',
        path: '/oauth/token',
        handler: async function(request, h) {
          console.log('/oauth/token...');
          console.log(request.headers);
          console.log(request.payload);

          let signedIdToken, signedAccessToken;
          if (_identityDb[request.payload.code]) {
            signedIdToken = _identityDb[request.payload.code].signedToken;
            signedAccessToken = _identityDb[request.payload.code].signedAccessToken;
          }
          else {
            // This step satisfies the earliest client-side auth tests,
            // which I am too sentimental to delete.
            signedIdToken = jwt.sign({..._identity,
                                         aud: process.env.AUTH0_CLIENT_ID,
                                         iat: Math.floor(Date.now() / 1000) - (60 * 60),
                                         iss: `https://${process.env.AUTH0_DOMAIN}/`,
                                         nonce: _identityDb[request.payload.code] ? _identityDb[request.payload.code].idToken.nonce : _nonce},
                                     prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })

            signedAccessToken = request.payload.code;

            let agent = await models.Agent.findOne({ where: { email: _profile.email } });
            if (!agent) {
              await models.Agent.create({
                email: _profile.email,
                socialProfile: {
                  ..._profile,
                  ...request.payload,
                  _json: { ..._profile, ...request.payload, sub: _profile.user_id },
                  user_id: _profile.user_id
                }
              });

            }
          }

          if (request.payload.grant_type === 'client_credentials') {
            return h.response({
              'access_token': signedAccessToken,
              'token_type': 'Bearer'
            });
          }

          return h.response({
            'access_token': signedAccessToken,
            'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
            'id_token': signedIdToken
          });
        }
      });

      /**
       * This will come in handing if we switch our
       * auth strategy again
       */
      server.route({
        method: 'GET',
        path: '/.well-known/jwks.json',
        handler: (request, h) => {
          console.log('/.well-known/jwks.json');
          console.log(keystore.toJSON());
          return JSON.stringify(keystore.toJSON());
        }
      });

      /**
       * Delivers as promised
       */
      server.route({
        method: 'GET',
        path: '/userinfo',
        handler: (request, h) => {
          console.log('/userinfo');
          console.log(request.headers);
          console.log(request.query);
          let idToken = _identityDb[request.query.access_token] ? _identityDb[request.query.access_token].idToken : _identity;
          return h.response(idToken);
        }
      });

      /**
       * Clear Auth0-set SSO session/cookies
       */
      server.route({
        method: 'GET',
        path: '/v2/logout',
        handler: (request, h) => {
          console.log('/v2/logout');
          console.log(`Redirecting home`);
          return h.redirect(process.env.SERVER_DOMAIN);
        }
      });


      /**
       * These are the Auth0 Management API endpoints
       * `/api/v2/*`
       */

      /**
       * GET `/users`
       *
       * This endpoint gets hit a lot.
       */
      server.route({
        method: 'GET',
        path: '/api/v2/users',
        handler: async function(request, h) {
          console.log('GET /api/v2/users');
          console.log(request.query)

          /**
           * Testing has revealed that names and fields aren't always consistent
           * between profile data and that returned by queries to Auth0.
           *
           * E.g., `user_id` vs. `sub` (perhaps not a _fair_ example given the role of `sub`)
           */
          const searchParams = {
            attributes: ['socialProfile'],
          };

          // For paging `/agents`
          if (request.query.page && request.query.per_page) {
            searchParams.offset = request.query.page * request.query.per_page,
            searchParams.limit = request.query.per_page
            const results = await models.Agent.findAll(searchParams);

            const profiles = results.map(p => { return {...p.socialProfile._json, user_id: p.socialProfile._json.sub } });

            profiles.sort((a, b) => {
              if (a.name < b.name) {
                return -1;
              }
              if (a.name > b.name) {
                return 1;
              }
              return 0;
            });
            console.log(profiles);

            const count = await models.Agent.count();

            return h.response({ users: profiles, start: request.query.page, limit: request.query.per_page, length: profiles.length, total: count });
          }

          // For retrieving team info `/team`
          if (request.query.q && /user_metadata\.teams\.id/.test(request.query.q)) {
            const results = await models.Agent.findAll(searchParams);

            // Get team ID from search string
            const teamId = request.query.q.match(/(?<=(["']\b))(?:(?=(\\?))\2.)*?(?=\1)/)[0];

            let data = results.filter(agent => {
              if (agent.socialProfile.user_metadata && agent.socialProfile.user_metadata.teams) {
                return agent.socialProfile.user_metadata.teams.find(team => team.id === teamId);
              }
              return false;
            });

            return h.response(data);
          }
        }
      });

      /**
       * POST `/users`
       */
      server.route({
        method: 'POST',
        path: '/api/v2/users',
        handler: async function(request, h) {
          console.log('POST /api/v2/users');
          console.log(request.payload);

          // Has this agent already been registed?
          let agent = await models.Agent.findOne({ where: {email: request.payload.token.email}});

          try {
            let userId = request.payload.token.sub + ++subIndex;
            let agent = new models.Agent({ email: request.payload.token.email,
                                           socialProfile: {
                                             ..._profile,
                                             ...request.payload,
                                             _json: { ..._profile, ...request.payload, sub: userId },
                                             user_id: userId
                                           }
                                         });

            let result = await agent.save();
            console.log(result);

            return h.response().code(201);
          } catch(err) {
            console.error(err);
            return h.response(err).code(500);
          }
        }
      });

      /**
       * GET `/users/:id`
       */
      server.route({
        method: 'GET',
        path: '/api/v2/users/{id}',
        handler: async function(request, h) {
          console.log('GET /api/v2/users/{id}');

          /**
           * Testing has revealed that names and fields aren't always consistent
           * between profile data and that returned by queries to Auth0.
           *
           * E.g., `user_id` vs. `sub` (perhaps not a _fair_ example given the role of `sub`)
           */
          const results = await models.Agent.findOne({ where: {
                                                                socialProfile: {
                                                                  '"user_id"': request.params.id
                                                                }
                                                            }, attributes: ['socialProfile'] });

          return h.response({...results.socialProfile, user_id: results.socialProfile._json.sub });
        }
      });

      /**
       * PATCH `/users`
       */
      server.route({
        method: 'PATCH',
        path: '/api/v2/users/{id}',
        handler: (request, h) => {
          console.log('PATCH /api/v2/users');
          console.log(request.payload);

          return h.response({
            "user_id": "auth0|507f1f77bcf86c0000000000",
            "email": "doesnotreallymatterforthemoment@example.com",
            "email_verified": false,
            "identities": [
              {
                "connection": "Initial-Connection",
              }
            ]
          });
        }
      });

      /**
       * GET `/users-by-email`
       */
      server.route({
        method: 'GET',
        path: '/api/v2/users-by-email',
        handler: (request, h) => {
          console.log('/api/v2/users-by-email');
          return h.response({});
        }
      });

      /**
       * POST `/users/:id/roles`
       */
      server.route({
        method: 'POST',
        path: '/api/v2/users/{id}/roles',
        handler: (request, h) => {
          console.log('/api/v2/users/{id}/roles');
          return h.response({});
        }
      });


      /**
       * GET `/roles`
       */
      server.route({
        method: 'GET',
        path: '/api/v2/roles',
        handler: (request, h) => {
          console.log('/api/v2/roles');
          return h.response([
            {
              "id": "123",
              "name": "viewer",
              "description": "View all roles"
            }
          ]);
        }
      });

      await server.start();
      console.log('Server running on %s', server.info.uri);
    };

    process.on('unhandledRejection', (err) => {
      console.log(err);
      process.exit(1);
    });

    init();
  });
}).catch(err => {
  console.error(err);
});


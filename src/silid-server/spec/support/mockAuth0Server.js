'use strict';
require('dotenv-flow').config();

const setupKeystore = require('../support/setupKeystore');
const jwt = require('jsonwebtoken');
const pem = require('pem');


if (process.env.NODE_ENV === 'e2e') {
  const models =  require('../../models');

  models.sequelize.sync({force: true}).then(() => {
    console.log('Database synced');
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
//const _access = require('../fixtures/sample-auth0-access-token');
//_access.iss = `http://${process.env.AUTH0_DOMAIN}/`;
const _identity = require('../fixtures/sample-auth0-identity-token');

/**
 * Allows multiple identities
 */
const identityDb = {};


setupKeystore((err, keyStuff) => {
  if (err) console.log(err);
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

//server.state('user', {
//    ttl: 24 * 60 * 60 * 1000,     // One day
//    isSecure: true,
//    isHttpOnly: true,
//    encoding: 'base64json',
//    clearInvalid: false,
//    strictHeader: true
//});

    await server.register({
      plugin: require('hapi-require-https'),
 //     options: {}
    })

    let _nonce;
    server.route({
      method: 'GET',
      path: '/authorize',
      handler: (request, h) => {
        console.log('/authorize');
        console.log(request.state);
        console.log(`http://${process.env.SERVER_DOMAIN}/callback?code=AUTHORIZATION_CODE&state=${request.query.state}`);
//        uri = uri.replace('/authorize?', '');
//        const parsed = querystring.parse(uri);
//        state = parsed.state;
//        nonce = parsed.nonce;
//        console.log(h);

        _nonce = request.query.nonce;

        return h.redirect(`http://${process.env.SERVER_DOMAIN}/callback?code=AUTHORIZATION_CODE&state=${request.query.state}`);
      }
    });


//          const oauthTokenScope = nock(`https://${process.env.AUTH0_DOMAIN}`)
//            .log(console.log)
//            .post(/oauth\/token/, {
//                                    'grant_type': 'authorization_code',
//                                    'redirect_uri': /\/callback/,
//                                    'client_id': process.env.AUTH0_CLIENT_ID,
//                                    'client_secret': process.env.AUTH0_CLIENT_SECRET,
//                                    'code': 'AUTHORIZATION_CODE'
//                                  })
//            .reply(200, {
//              'access_token': signedAccessToken,
//              'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
//              'id_token': signedIdToken });


    server.route({
      method: 'POST',
      path: '/oauth/token',
      handler: (request, h) => {
        console.log('/oauth/token...');
        const signedIdToken = jwt.sign({..._identity,
                                            aud: process.env.AUTH0_CLIENT_ID,
                                            iat: Math.floor(Date.now() / 1000) - (60 * 60),
                                            iss: `https://${process.env.AUTH0_DOMAIN}/`,
                                            nonce: _nonce },
                                         prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })

        return JSON.stringify({
          'access_token': 'SOME_MADE_UP_ACCESS_TOKEN',
          'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
          'id_token': signedIdToken });
//        return JSON.stringify({
//              'access_token': signedAccessToken,
//              'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
//              'id_token': signedIdToken });
      }
    });


    server.route({
      method: 'GET',
      path: '/.well-known/jwks.json',
      handler: (request, h) => {
        console.log('/.well-known/jwks.json');
        console.log(keystore.toJSON());
        return JSON.stringify(keystore.toJSON());
      }
    });

    server.route({
      method: 'GET',
      path: '/userinfo',
      handler: (request, h) => {
        console.log('/userinfo');
        console.log(request.headers);

        // Need to make email dynamic for multi-agent sign-in
        return { ..._identity};//, email: `agent${identityDb[decoded.sub]}@example.com` };
      }
    });

    server.route({
      method: 'POST',
      path: '/sign',
      handler: (request, h) => {
        console.log('/sign');
        const signed = jwt.sign(request.payload.accessToken, prv, { algorithm: 'RS256', header: { kid: result.kid } });

        // Add agent to identity "database"
        if(!identityDb[request.payload.accessToken.sub]) {
          identityDb[request.payload.accessToken.sub] = Object.keys(identityDb).length + 1;
        }

        return signed;
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
});


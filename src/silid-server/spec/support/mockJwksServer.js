'use strict';
require('dotenv-flow').config();


if (process.env.NODE_ENV === 'e2e') {
  const models =  require('../../models');

  models.sequelize.sync({force: true}).then(() => {
    console.log('Database synced');
  }).catch(err => {
    console.error(err);
  });
}

/**
 * Mock server for critical Auth0 endpoints:
 *
 * `/.well-known/jwks.json` endpoint
 * `/userinfo` endpoint
 *
 * Convenient signed-token access:
 * `/access` endpoint
 *
 */
const jwt = require('jsonwebtoken');

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


/**
 * Crypto stuff
 */
const jose = require('node-jose');
const pem2jwk = require('pem-jwk').pem2jwk
const NodeRSA = require('node-rsa');

/**
 * Build RSA key
 */
const key = new NodeRSA({b: 512, e: 5});
key.setOptions({
  encryptionScheme: {
    scheme: 'pkcs1',
    label: 'Optimization-Service'
  }
});

// Get public/private pair
const prv = key.exportKey('pkcs1-private-pem');
const pub = key.exportKey('pkcs8-public-pem');

/**
 * This endpoint returns the `jwks.json` token required to validate an
 * agent's token.
 *
 * A keystore stores the keys. You must assume there can be more than
 * one (key, that is)
 */
const keystore = jose.JWK.createKeyStore();

// Convert PEM to JWK object
let jwkPub = pem2jwk(pub);
jwkPub.use = 'sig';
jwkPub.alg = 'RS256';

keystore.add(jwkPub, 'pkcs8').then(function(result) {

  /**
   * Fake JWKS server
   */
  const Hapi = require('@hapi/hapi');
  
  const init = async () => {
  
    const server = Hapi.server({
      port: 3002,
      host: '0.0.0.0',
      routes: {
        cors: true
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
        const decoded = jwt.verify(request.headers.authorization.split(' ')[1], prv, { algorithms: ['RS256'] });//, function(err, decoded) {
        console.log(decoded);
        return { ..._identity, email: `agent${identityDb[decoded.sub]}@example.com` };
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

}).catch(err => {
  done(err);
});


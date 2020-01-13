/**
 * Mock the Auth0 `/.well-known/jwks.json` endpoint
 *
 * Not configurable, though self-documenting and reusable
 */
const jwt = require('jsonwebtoken');
const nock = require('nock');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _access = require('../fixtures/sample-auth0-access-token');
_access.iss = `http://${process.env.AUTH0_DOMAIN}/`;

const jose = require('node-jose');
const pem2jwk = require('pem-jwk').pem2jwk
const NodeRSA = require('node-rsa');

/**
 * Auth0 `/.well-known/jwks.json` mock
 */
module.exports = function(done) {

  // Note to future self: this will probably muck things up if I
  // try to stub any other services
  nock.cleanAll();

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
    const signedAccessToken = jwt.sign(_access, prv, { algorithm: 'RS256', header: { kid: result.kid } });

    scope = nock(`http://${process.env.AUTH0_DOMAIN}`)
      .persist()
      .log(console.log)
      .get('/.well-known/jwks.json')
      .reply(200, keystore);

    done(null, {scope, signedAccessToken, pub, prv, keystore});
  }).catch(err => {
    done(err);
  });
};

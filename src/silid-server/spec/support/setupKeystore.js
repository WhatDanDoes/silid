
const jwt = require('jsonwebtoken');
const jose = require('node-jose');
const pem2jwk = require('pem-jwk').pem2jwk
const NodeRSA = require('node-rsa');

module.exports = function(done) {

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
   * A keystore stores the keys. You must assume there can be more than
   * one (key, that is)
   */
  const keystore = jose.JWK.createKeyStore();

  // Convert PEM to JWK object
  let jwkPub = pem2jwk(pub);
  jwkPub.use = 'sig';
  jwkPub.alg = 'RS256';

  keystore.add(jwkPub, 'pkcs8').then(function(result) {
    done(null, {pub, prv, keystore});
  }).catch(err => {
    done(err);
  });
};

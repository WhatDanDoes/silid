import history from '../history';

/**
 * 2019-12-21
 *
 * https://community.auth0.com/t/custom-domain-in-angular/21883/5
 *
 * _Object literal may only specify known properties, and 'overrides' does not
 * exist in type 'AuthOptions'.  TS2345_
 *
 * `overrides` is needed for testing and I'm tired of fighting with Typescript,
 * so the regular Javascript file is being imported.
 */
//import auth0 from 'auth0-js';
//import auth0 from '../../node_modules/auth0-js/src';
import auth0 from '../../node_modules/auth0-js/dist/auth0.min.js';

import { AUTH_CONFIG } from './auth0-variables';

export default class Auth {
  accessToken: any;
  idToken: any;
  profile: any;
  expiresAt: any;

  /**
   * For testing
   */
  options = {} as any;

  auth0 = new auth0.WebAuth({
    domain: AUTH_CONFIG.domain,
    clientID: AUTH_CONFIG.clientId,
    redirectUri: AUTH_CONFIG.callbackUrl,
    audience: AUTH_CONFIG.audience,
    responseType: 'token id_token',
    scope: 'openid email profile',
    // These overrides are only used for testing (currently)
    overrides: process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? {
      __jwks_uri: 'http://localhost:3002/.well-known/jwks.json',
      __tenant: 'some-guy',
      __token_issuer: `https://${AUTH_CONFIG.domain}/`,
    }: undefined,
  });

  constructor() {
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.handleAuthentication = this.handleAuthentication.bind(this);
    this.isAuthenticated = this.isAuthenticated.bind(this);
    this.getAccessToken = this.getAccessToken.bind(this);
    this.getIdToken = this.getIdToken.bind(this);
    this.renewSession = this.renewSession.bind(this);
    this.getProfile = this.getProfile.bind(this);
  }

  login() {
    this.auth0.authorize();
  }

  handleAuthentication() {
    return new Promise((resolve, reject) => {
      let options = {} as any;

      /**
       * For testing
       *
       * Of places to set `state`, this seems to be the one that matters!!!
       */
      if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        options.state = 'abc123';
      }

//      options.hash = window.location.hash.replace(/^#\/?callback/, '');

      this.auth0.parseHash(options, (err, authResult) => {
        if (err) return reject(err);
        if (!authResult || !authResult.idTokenPayload) {
          return reject(err);
        }
        this.setSession(authResult);
        resolve();
      });
    });
  }

  getAccessToken() {
    return this.accessToken;
  }

  getIdToken() {
    return this.idToken;
  }

  getProfile() {
    return this.profile;
  }

  setSession(authResult: any) {
    // Set isLoggedIn flag in localStorage
    localStorage.setItem('isLoggedIn', 'true');

    // Set the time that the access token will expire at
    let expiresAt = authResult.expiresIn * 1000 + new Date().getTime();
    localStorage.setItem('accessToken', authResult.accessToken);
    localStorage.setItem('idToken', authResult.idToken);
    localStorage.setItem('expiresAt', expiresAt.toString());
    localStorage.setItem('profile', JSON.stringify(authResult.idTokenPayload));
    // navigate to the home route

    window.location.href = '/';
  }

  renewSession() {
    this.auth0.checkSession({}, (err, authResult) => {
      if (authResult && authResult.accessToken && authResult.idToken) {
        this.setSession(authResult);
      } else if (err) {
        this.logout();
        console.log(err);
        alert(
          `Could not get a new token (${err.error}: ${err.error_description}).`
        );
      }
    });
  }

  logout() {
    // Remove isLoggedIn flag from localStorage
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('profile');
    localStorage.removeItem('expiresAt');

    this.auth0.logout({
      returnTo: window.location.origin,
    });

    // navigate to the home route
    history.replace('/home');
  }

  isAuthenticated() {
    // Check whether the current time is past the
    // access token's expiry time
    const expiresAt = Number(localStorage.getItem('expiresAt'));
    return new Date().getTime() < expiresAt;
  }
}

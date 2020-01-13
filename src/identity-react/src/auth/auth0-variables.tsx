export const AUTH_CONFIG = {
  //domain: 'silid.auth0.com',
  domain: process.env.REACT_APP_DOMAIN,
  //clientId: 'tjrl8aOQEx9AtQhFffuWmvP6bcHM7nXB',
  clientId: process.env.REACT_APP_CLIENT_ID,
  //callbackUrl:'https://profile-dev.languagetechnology.org/callback',
  callbackUrl: process.env.REACT_APP_CALLBACK_URL,
  audience: 'https://id.languagetechnology.org/',
  offline: 'true'
};

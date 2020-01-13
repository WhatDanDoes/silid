/**
 * Auth0 is a real pain to stub. This fakes login by setting some
 * items in localStorage
 */
Cypress.Commands.add('login', function(token) {
  Cypress.log({
    name: 'loginViaAuth0',
  });

  // Sign an access token
  cy.request({ url: 'http://localhost:3002/sign', method: 'POST', body: { accessToken: token } }).then(function(res) {
    const signedToken = res.body;

    // Sign an identity token
    cy.request({ url: 'http://localhost:3002/sign', method: 'POST',
                 body: { accessToken: { iss: `https://${Cypress.env('REACT_APP_DOMAIN')}/`, aud: Cypress.env('REACT_APP_CLIENT_ID') } } }).then(function(res) {
      const idToken = res.body;

      // Access with a token creates an agent the database
      cy.request({ url: '/agent',  method: 'GET', auth: { bearer: signedToken } }).then(function(res) {

        cy.visit('/', {
          onBeforeLoad: (win) => {
            win.localStorage.setItem('isLoggedIn', 'true');
            win.localStorage.setItem('accessToken', signedToken);
            win.localStorage.setItem('idToken', idToken);
            win.localStorage.setItem('expiresAt', Math.floor(new Date()) + 3600);
            win.localStorage.setItem('profile', JSON.stringify(res.body.socialProfile));
          },
        });
      });
    });
  });
});


Cypress.Commands.add('logout', function() {
  Cypress.log({
    name: 'logout',
  });

  cy.visit('/', {
    onBeforeLoad: (win) => {
      win.localStorage.removeItem('isLoggedIn');
      win.localStorage.removeItem('accessToken');
      win.localStorage.removeItem('idToken');
      win.localStorage.removeItem('expiresAt');
      win.localStorage.removeItem('profile');
    },
  });
});



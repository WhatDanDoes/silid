/**
 * Auth0 is a real pain to stub. 
 *
 * This preps an ID token and initiates the client-side login
 */
Cypress.Commands.add('login', function(email, profile) {
  Cypress.log({
    name: 'loginViaAuth0',
  });

  cy.fixture('google-profile-response').as('profile');

  // Register a test agent with an identity token
  cy.request({ url: 'https://localhost:3002/register', method: 'POST',
             body: { token: { ...profile,
                                 email: email,
                                 iss: `https://${Cypress.env('REACT_APP_DOMAIN')}/`,
                                 aud: Cypress.env('REACT_APP_CLIENT_ID') } }
            }).then(function(res) {
    cy.visit('/');
    cy.contains('Login').click();
  });
});


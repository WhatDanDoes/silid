/**
 * Auth0 is a real pain to stub.
 *
 * This preps an ID token and initiates the client-side login
 */
Cypress.Commands.add('login', function(email, profile, permissions = []) {
  Cypress.log({
    name: 'loginViaAuth0',
  });

  cy.clearCookies();

  // Register a test agent with an identity token
  cy.request({ url: 'https://localhost:3002/register', method: 'POST',
             body: { token: { ...profile,
                                 email: email,
                            },
                     permissions: permissions }
            }).then(function(res) {
    cy.visit('/');
    cy.contains('Login').click();
    cy.wait(300);
  });
});


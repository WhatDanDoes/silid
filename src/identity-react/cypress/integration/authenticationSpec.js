// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Authentication', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('someguy-auth0-access-token.json').as('agent');
  });

  describe('browser behaviour', () => {
    it('sets a cookie on first visit', () => {
      cy.getCookies().should('have.length', 0);

      cy.visit('/');

      /**
       * A visit to home hits the dev server, so no cookie is set.
       * `/login` hits the app server, so cookie is set.
       */
      cy.contains('Login').click();
      cy.getCookies().should('have.length', 1).then(cookies => {
        expect(cookies[0]).to.have.property('name', 'connect.sid');
        expect(cookies[0]).to.have.property('value');
        expect(cookies[0]).to.have.property('domain');
        expect(cookies[0]).to.have.property('httpOnly', true);
        expect(cookies[0]).to.have.property('path', '/');
        expect(cookies[0]).to.have.property('secure', false); // false because tests are HTTP
      });
    });
  });

  context('unsuccessful authentication', () => {
    beforeEach(() => {
//      cy.visit(`/callback#access_token=${accessToken}&scope=openid%20profile%20email&expires_in=7200&token_type=Bearer&state=BAD_STATE_CREATES_ERROR&id_token=${idToken}`);
    });

    it('renders the interface', () => {
//      cy.get('#login-button').should('exist');
//      cy.get('#logout-button').should('not.exist');
//      cy.get('h3').contains('Something went terribly wrong');
    });
  });

  context('successful authentication', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.contains('Login').click();
    });

    it('lands in the right place', () => {
      cy.url().should('match', /\/#\/$/);
    });

    it('renders the interface', () => {
      cy.get('#logout-button').contains('Logout');
    });
  });

  describe('not logged in', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    context('first visit', () => {
      it('shows the home page', () => {
        cy.get('h6').contains('Identity');
      });

      it('displays the login button', () => {
        cy.get('#login-button').contains('Login');
      });

      it('does not display the logout button', () => {
        cy.get('#logout-button').should('not.exist');
      });
    });
  });

  describe('logged in', () => {
    beforeEach(function() {
      cy.visit('/');
      cy.contains('Login').click();
    });

    it('lands in the right place', () => {
      cy.url().should('match', /\/#\/$/);
    });

    it('does not display the login link', () => {
      cy.get('#login-button').should('not.exist');
    });

    it('renders the navbar correctly', function() {
      cy.get('#logout-button').contains('Logout');
      cy.get('img[alt=avatar]').should('have.attr', 'src', this.profile.picture);
    });

    it('renders the app-menu correctly', () => {
      cy.get('#app-menu').should('not.exist');
      cy.get('#app-menu-button').click();

      cy.get('#app-menu ul div:nth-of-type(1) a').should('have.attr', 'href', '#/').and('contain', 'Home');
      cy.get('#app-menu ul div:nth-of-type(2) a').should('have.attr', 'href', '#agent').and('contain', 'Personal Info');
      cy.get('#app-menu ul div:nth-of-type(3) a').should('have.attr', 'href', '#organization').and('contain', 'Organizations');
      cy.get('#app-menu ul:nth-of-type(2) div').contains('Help');
    });
  });
});

export {}

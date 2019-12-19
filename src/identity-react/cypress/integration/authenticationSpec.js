// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Authentication', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('someguy-auth0-access-token.json').as('agent');
  });

  describe('/callback', () => {

    let accessToken, state, idToken;
    beforeEach(function() {
      // Need a legitmate accessToken/idToken...
      cy.login(this.agent);
      cy.visit('/').then(() => {
        accessToken = localStorage.getItem('accessToken');
        idToken = localStorage.getItem('idToken');
  
  cy.log('accessToken');
  cy.log(accessToken);
        cy.logout();

        // CSRF prevention requires state to match
        state = 'abc123';
      });
    });

    it('sets the required values in localStorage', () => {
cy.log('TESTING');
//      expect(localStorage.getItem('profile')).to.be.null;
//      expect(localStorage.getItem('isLoggedIn')).to.be.null;
      expect(localStorage.getItem('accessToken')).to.be.null;
//      expect(localStorage.getItem('idToken')).to.be.null;
//      expect(localStorage.getItem('expiresAt')).to.be.null;
//      expect(localStorage.getItem('profile')).to.be.null;

      cy.visit(`/callback#/access_token=${accessToken}&scope=openid%20profile%20email&expires_in=7200&token_type=Bearer&state=${state}&id_token=${idToken}`).then(() => {

//        expect(localStorage.getItem('profile')).to.not.be.null;
//        expect(localStorage.getItem('isLoggedIn')).to.not.be.null;
        expect(localStorage.getItem('accessToken')).to.not.be.null;
//        expect(localStorage.getItem('idToken')).to.be.not.null;
//        expect(localStorage.getItem('expiresAt')).to.not.be.null;
//        expect(localStorage.getItem('profile')).to.not.be.null;
      });
    });

    context('unsuccessful authentication', () => {
      beforeEach(() => {
        cy.visit(`/callback#/access_token=INVALID_TOKEN&scope=openid%20profile%20email&expires_in=7200&token_type=Bearer&state=${state}&id_token=${idToken}`);
      });

      it('lands in the right place', () => {
        cy.url().should('match', /^\/#\/$/);
      });
  
      it('renders the interface', () => {
        cy.get('#login-button').contains('Login');
        cy.get('h3').contains('Invalid token');
      });
    });

    context('successful authentication', () => {
      beforeEach(() => {
        cy.visit(`/callback#/access_token=${accessToken}&scope=openid%20profile%20email&expires_in=7200&token_type=Bearer&state=${state}&id_token=${idToken}`);
      });

      it('lands in the right place', () => {
        cy.url().should('match', /^\/#\/$/);
      });
  
      it('renders the interface', () => {
        cy.get('#logout-button').contains('Logout');
      });
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
      cy.login(this.agent);
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

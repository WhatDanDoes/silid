context('viewer/Authentication', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('browser behaviour', () => {
    it('sets a cookie on first visit', () => {
      cy.clearCookies();
      cy.getCookies().should('have.length', 0);

      cy.visit('/');

      cy.getCookies().should('have.length', 1).then(cookies => {
        // This doesn't reflect production cookie expectations
        expect(cookies[0]).to.have.property('name', 'silid-server');
        expect(cookies[0]).to.have.property('value');
        expect(cookies[0]).to.have.property('domain');
        expect(cookies[0]).to.have.property('httpOnly', true);
        expect(cookies[0]).to.have.property('path', '/');
        expect(cookies[0]).to.have.property('secure', false); // false because tests are HTTP
      });
    });
  });

  describe('not logged in', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    context('first visit', () => {
      it('shows the home page', () => {
        cy.get('header h1').contains('Identity');
      });

      it('displays the login button', () => {
        cy.get('#login-link').contains('Login');
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
      cy.wait(300);
    });

    it('lands in the right place', () => {
      cy.url().should('match', /\/#\/agent$/);
    });

    it('does not display the login link', () => {
      cy.get('#login-link').should('not.exist');
    });

    it('renders the navbar correctly', function() {
      cy.get('#logout-button').contains('Logout');
      cy.get('img[alt=avatar]').should('have.attr', 'src', this.profile.picture);
      cy.get('header h6 a').should('contain', 'Identity').and('have.attr', 'href').and('equal', '/');
    });

    it('does not render the app-menu', () => {
      cy.get('#app-menu').should('not.exist');
      cy.get('#app-menu-button').should('not.exist');
    });

    describe('post sign-in', function() {
      it('displays a friendly message', function() {
        cy.contains(`Hello, ${this.profile.name}`);
      });

      it('allows you to dismiss the sign-in message', function() {
        cy.get('#flash-message').should('exist');
        cy.get('#close-flash').click();
        cy.get('#flash-message').should('not.exist');
      });
    });

    describe('home link', () => {
      it('lands in the right spot', () => {
        cy.contains('Identity').click();
        cy.wait(100);
        cy.url().should('match', /\/#\/agent$/);
      });
    });

    describe('logout', () => {
      it('clears the cookies', () => {
        cy.getCookies().should('have.length', 1);
        cy.getCookies().then(oldCookies => {
          expect(oldCookies.length).to.equal(1)

          cy.contains('Logout').click();

          cy.getCookies().should('have.length', 1);
          cy.getCookies().then(newCookies => {
            expect(oldCookies[0].name).to.equal(newCookies[0].name)
            expect(oldCookies[0].value).to.not.equal(newCookies[0].value)
          });
        });
      });

      it('lands in the right place', () => {
        const cypressConfig = require('../../../cypress.json');
        cy.contains('Logout').click();
        cy.url().should('match', new RegExp(cypressConfig.baseUrl));
      });

      it('renders the interface', () => {
        cy.get('#login-link').should('not.exist');
        cy.get('#logout-button').should('exist');

        cy.contains('Logout').click();

        cy.get('#login-link').should('exist');
        cy.get('#logout-button').should('not.exist');
      });
    });

    describe('localization', () => {
      beforeEach(() => {
        cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
        cy.wait(300);
        cy.get('#profile-table table tbody tr td #sil-local-dropdown').type('kling{downarrow}{enter}');
        cy.wait(300);
        cy.contains('Mej').click(); // Because it's in Klingon now
        cy.contains('Login').click();
      });

      it('displays a friendly message', function() {
        cy.contains(`NuqneH, ${this.profile.name}`);
      });

      it('renders the navbar correctly', function() {
        cy.get('#logout-button').contains('Mej');
        cy.get('img[alt=avatar]').should('have.attr', 'src', this.profile.picture);
        cy.get('header h6 a').should('contain', 'vIchIDmeH, Qatlh Qu\'').and('have.attr', 'href').and('equal', '/');
      });
    });
  });
});

export {}

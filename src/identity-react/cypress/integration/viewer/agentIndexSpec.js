context('viewer/Agent Index', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/agent');
    });

    it('shows the home page', () => {
      cy.get('header h1').contains('Identity');
    });

    it('displays the login button', () => {
      cy.get('#login-link').contains('Login');
    });

    it('does not display the logout button', () => {
      cy.get('#logout-button').should('not.exist');
    });

    it('redirects home', () => {
      cy.location('pathname').should('equal', '/');
    });
  });

  describe('authenticated', () => {

    context('first visit', () => {
      beforeEach(function() {
        cy.login(_profile.email, _profile, [this.scope.read.agents]);
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/agent');
      });

      describe('profile highlights', () => {
        it('displays fields in a table', function() {
          cy.get('h3').contains('Profile');
          cy.get('table tbody tr th').contains('Display Name:');
          cy.get('table tbody tr td').contains(this.profile.name);
          cy.get('table tbody tr th').contains('Email:');
          cy.get('table tbody tr td').contains(this.profile.email);
          cy.get('table tbody tr th').contains('Locale:');
          cy.get('table tbody tr td').contains(this.profile.locale);
        });
      });

      describe('teams', () => {
        it('displays teams in a table', function() {
          cy.get('h6').contains('Teams');
        });
      });

      describe('social profile data', () => {
        it('toggles JSON display', () => {
          cy.get('.react-json-view').its('length').should('eq', 1);

          // Toggle closed
          cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
          cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
          cy.get('.react-json-view').contains('displayName').should('not.exist');

          // Toggle open
          cy.get('.react-json-view .icon-container .collapsed-icon').click();
          cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

          cy.get('.react-json-view').contains('locale');
          cy.get('.react-json-view').contains('picture');
          cy.get('.react-json-view').contains('user_id');
          cy.get('.react-json-view').contains('displayName');

          // Toggle closed again
          cy.get('.react-json-view .icon-container .expanded-icon').click();
          cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
          cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
          cy.get('.react-json-view').contains('displayName').should('not.exist');
        });
      });


    });
  });
});

export {}

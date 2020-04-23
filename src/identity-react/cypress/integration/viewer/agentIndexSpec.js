context('viewer/Agent Index', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
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
        describe('none created', () => {
          it('displays teams table', function() {
            cy.get('h6').contains('Teams');
            cy.get('table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          let agent;
          beforeEach(function() {
            cy.login(_profile.email, {..._profile, user_metadata: {
                                                     teams: [
                                                       {
                                                         id: 'some-uuid-v4',
                                                         name: 'The Calgary Roughnecks',
                                                         leader: 'someguy@example.com',
                                                         members: ['someguy@example.com']
                                                       }
                                                     ]
                                                   } }, [this.scope.read.agents]);

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
              agent = results[0];
              cy.reload(true);
              cy.wait(300);
            });
          });

          it('displays teams in a table', function() {
            cy.get('h6').contains('Teams');
            cy.get('table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('button span span').contains('add_box');
            cy.get('table thead tr th').contains('Actions');
            cy.get('table tbody tr td button span').contains('edit');
            cy.get('table tbody tr td button span').contains('delete_outline');
            cy.get('table thead tr th').contains('Name');
            cy.get('table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].name);
            cy.get('table tbody tr td a').should('contain', agent.socialProfile.user_metadata.teams[0].name).
              and('have.attr', 'href').and('equal', `#team/${agent.socialProfile.user_metadata.teams[0].id}`);
            cy.get('table thead tr th').contains('Leader');
            cy.get('table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].leader);
          });
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

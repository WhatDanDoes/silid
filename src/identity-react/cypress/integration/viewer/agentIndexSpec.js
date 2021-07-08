import npmPackage from '../../../package.json';

context('viewer/Agent Index', () => {

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
      beforeEach(() => {
        cy.login(_profile.email, _profile);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/agent');
      });

      it('sets app build version metadata', done => {
        // Build version is only set when the app is built and bundled...
        if (Cypress.env('TEST_BUILD')) {
          cy.exec('git rev-parse --short HEAD').then(commit => {
            cy.get('html head meta[name="generator"]').contains(`${npmPackage.version}-${commit.stdout}`);
            done();
          });
        }
        // ... otherwise it just shows the variable placeholders
        else {
          cy.get('html head meta[name="build"]').should('have.attr', 'content', '%REACT_APP_VERSION%-%REACT_APP_COMMIT%');
          done();
        }
      });

      describe('profile highlights', () => {
        it('displays fields in a table', function() {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', this.profile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

          cy.get('#profile-table table tbody tr th').contains('Email:');
          cy.get('#profile-table table tbody tr td').contains(this.profile.email);

          cy.get('#profile-table table tbody tr th').contains('Provider Locale:');
          cy.get('#profile-table table tbody tr td').contains(this.profile.locale);

          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
          cy.get('#profile-table table tbody tr:last-of-type th').contains('Roles:');
          cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
          cy.get('#profile-table table tbody tr:last-of-type div:last-of-type').contains('viewer');
          cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');

          cy.get('button#save-agent').should('not.exist');
          cy.get('button#cancel-agent-changes').should('not.exist');
        });
      });

      describe('organizations', () => {
        it('does not display the organizations table', () => {
          cy.get('#organizations-table').should('not.exist');
        });
      });

      describe('teams', () => {
        describe('none created', () => {
          it('displays teams table', () => {
            cy.get('#teams-table h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          let agent;
          beforeEach(() => {
            cy.login(_profile.email, {..._profile, user_metadata: {
                                                     teams: [
                                                       {
                                                         id: 'some-uuid-v4',
                                                         name: 'The Calgary Roughnecks',
                                                         leader: 'someguy@example.com',
                                                         members: ['someguy@example.com']
                                                       }
                                                     ]
                                                   } });

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
              agent = results[0];
              cy.reload(true);
              cy.wait(300);
            });
          });

          it('displays teams in a table', () => {
            cy.get('#teams-table h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('#teams-table button span span').contains('add_box');
            cy.get('#teams-table table thead tr th').contains('Name');
            cy.get('#teams-table table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].name);
            cy.get('#teams-table table tbody tr td a').should('contain', agent.socialProfile.user_metadata.teams[0].name).
              and('have.attr', 'href').and('equal', `#team/${agent.socialProfile.user_metadata.teams[0].id}`);
            cy.get('#teams-table table thead tr th').contains('Leader');
            cy.get('#teams-table table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].leader);
          });
        });
      });

      describe('social profile data', () => {
        it('toggles JSON display', () => {
          cy.get('.react-json-view').its('length').should('eq', 1);

          // Toggle closed
          cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
          cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
          cy.get('.react-json-view').contains('name').should('not.exist');

          // Toggle open
          cy.get('.react-json-view .icon-container .collapsed-icon').click();
          cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

          cy.get('.react-json-view').contains('locale');
          cy.get('.react-json-view').contains('picture');
          cy.get('.react-json-view').contains('user_id');
          cy.get('.react-json-view').contains('name');

          // Toggle closed again
          cy.get('.react-json-view .icon-container .expanded-icon').click();
          cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
          cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
          cy.get('.react-json-view').contains('name').should('not.exist');
        });
      });
    });
  });
});

export {}

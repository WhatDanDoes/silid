context('organizer/Agent Index', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {
      ...this.profile,
      // 2020-7-3 This is a shortcut. Should I have root assign the organizer role?
      roles: [
        {
          "id": "123",
          "name": "organizer",
          "description": "Manage organizations and team memberships therein"
        },
        {
          "id": "345",
          "name": "viewer",
          "description": "Basic agent, organization, and team viewing permissions"
        }
      ]
    };
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

      describe('hamburger menu', () => {
        it.only('allows access to the Agent Directory', () => {
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').check();
          cy.contains('Agent Directory').click();
          cy.wait(200);
          cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 1);
        });
      });

      describe('profile highlights', () => {
        it('displays fields in a table', function() {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td').contains(this.profile.name);
          cy.get('#profile-table table tbody tr th').contains('Email:');
          cy.get('#profile-table table tbody tr td').contains(this.profile.email);
          cy.get('#profile-table table tbody tr th').contains('Locale:');
          cy.get('#profile-table table tbody tr td').contains(this.profile.locale);
          cy.get('#profile-table table tbody tr th').contains('Roles:');
          cy.get('#profile-table table tbody tr div').its('length').should('eq', 2);
          cy.get('#profile-table table tbody tr div:first-of-type').contains('organizer');
          cy.get('#profile-table table tbody tr div:last-of-type').contains('viewer');
          cy.get('#profile-table table tbody tr div#assign-role').should('not.exist');
        });
      });

      describe('organizations', () => {
        describe('none created', () => {
          it('displays organizations table', () => {
            cy.get('#organizations-table h6').contains('Organizations');
            cy.get('#organizations-table table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          let agent;
          beforeEach(() => {
            cy.login(_profile.email, {..._profile, user_metadata: {
                                                     organizations: [
                                                       {
                                                         id: 'some-uuid-v4',
                                                         name: 'The National Lacrosse League',
                                                         organizer: 'someguy@example.com',
                                                       }
                                                     ]
                                                   } });

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
              agent = results[0];
              cy.reload(true);
              cy.wait(300);
            });
          });

          it('displays organizations in a table', () => {
            cy.get('#organizations-table h6').contains('Organizations');
            cy.get('#organizations-table table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('#organizations-table button span span').contains('add_box');
            cy.get('#organizations-table table thead tr th').contains('Name');
            cy.get('#organizations-table table tbody tr td').contains(agent.socialProfile.user_metadata.organizations[0].name);
            cy.get('#organizations-table table tbody tr td a').should('contain', agent.socialProfile.user_metadata.organizations[0].name).
              and('have.attr', 'href').and('equal', `#organization/${agent.socialProfile.user_metadata.organizations[0].id}`);
            cy.get('#organizations-table table thead tr th').contains('Organizer');
            cy.get('#organizations-table table tbody tr td').contains(agent.socialProfile.user_metadata.organizations[0].organizer);
          });
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

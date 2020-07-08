/**
 * 2020-7-3
 *
 * It's difficult to wrap my head around precisely what is being tested here.
 * While it is important to test basic functionality while an agent is acting
 * in the organizer role, there is a question of how far to push it, and how
 * much coverage to pursue.
 *
 * For now, this is testing an organizer viewing himself and the profiles of
 * other organizers.
 */
context('organizer/Agent show', function() {

  let organizerAgent;
  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = { ...this.profile };
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Invitations" CASCADE;');
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit(`/#/agent/333`);
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
    describe('viewing organizer agent\'s profile', () => {
      beforeEach(() => {
        // A convenient way to create a new agent
        cy.login('someotherguy@example.com', {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy' });
        // Make this agent an organizer via a call to the mock server
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          organizerAgent = results[0];
          cy.request('POST', `https://localhost:3002/api/v2/users/${organizerAgent.socialProfile.user_id}/roles`, { roles: ['123'] });

          cy.login('someguy@example.com', _profile);
          cy.visit(`/#/agent/${organizerAgent.socialProfile.user_id}`);
          cy.wait(300);
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/agent/${organizerAgent.socialProfile.user_id}`);
      });

      it('displays agent\'s info', () => {
        cy.get('h3').contains('Profile');
        cy.get('#profile-table table tbody tr th').contains('Name:');
        cy.get('#profile-table table tbody tr td').contains(organizerAgent.socialProfile.name);
        cy.get('#profile-table table tbody tr th').contains('Email:');
        cy.get('#profile-table table tbody tr td').contains(organizerAgent.socialProfile.email);
        cy.get('#profile-table table tbody tr th').contains('Locale:');
        cy.get('#profile-table table tbody tr td').contains(organizerAgent.socialProfile.locale);
        cy.get('#profile-table table tbody tr th').contains('Roles:');
        cy.get('#profile-table table tbody tr ul li').its('length').should('eq', 2);
        cy.get('#profile-table table tbody tr ul li').contains('organizer');
        cy.get('#profile-table table tbody tr ul li').contains('viewer');
        cy.get('#profile-table table tbody tr ul li #assign-role').should('not.exist');
      });

      it('does not display the assign-role chip', () => {
        cy.get('#profile-table table tbody tr ul li:last-of-type #assign-role').should('not.exist');
      });

      describe('organizations', () => {
        describe('none created', () => {
          it('displays organizations table', () => {
            cy.get('#organizations-table h6').contains('Organizations');
            cy.get('#organizations-table table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          beforeEach(() => {
            cy.login('someotherguy@example.com', {..._profile, user_metadata: {
                                                     organizations: [
                                                       {
                                                         id: 'some-uuid-v4',
                                                         name: 'The National Lacrosse League',
                                                         organizer: 'someotherguy@example.com',
                                                       }
                                                     ]
                                                   } });

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
              organizerAgent = results[0];

              cy.login('someguy@example.com', _profile);
              cy.visit(`/#/agent/${organizerAgent.socialProfile.user_id}`);

              cy.wait(300);
            });
          });

          it('displays organizations in a table', () => {
            cy.get('#organizations-table h6').contains('Organizations');
            cy.get('#organizations-table table tbody tr td').contains('No records to display').should('not.exist');
            // No button to add an organization
            cy.get('#organizations-table button span span').should('not.exist');
            cy.get('#organizations-table table thead tr th').contains('Name');
            cy.get('#organizations-table table tbody tr td').contains(organizerAgent.socialProfile.user_metadata.organizations[0].name);
            cy.get('#organizations-table table tbody tr td a').should('contain', organizerAgent.socialProfile.user_metadata.organizations[0].name).
              and('have.attr', 'href').and('equal', `#organization/${organizerAgent.socialProfile.user_metadata.organizations[0].id}`);
            cy.get('#organizations-table table thead tr th').contains('Organizer');
            cy.get('#organizations-table table tbody tr td').contains(organizerAgent.socialProfile.user_metadata.organizations[0].organizer);
          });
        });
      });


      describe('teams', () => {
        it('does not display add-team button', () => {
          cy.get('#teams-table button').should('not.exist');
        });

        describe('none created', () => {
          it('displays teams table', () => {
            cy.get('h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          let agent;
          beforeEach(() => {
            cy.login('someotherguy@example.com', {..._profile, user_metadata: {
                                                     teams: [
                                                       {
                                                         id: 'some-uuid-v4',
                                                         name: 'The Calgary Roughnecks',
                                                         leader: 'someguy@example.com',
                                                       }
                                                     ]
                                                   } });

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
              organizerAgent = results[0];
              cy.login('someguy@example.com', _profile);
              cy.visit(`/#/agent/${organizerAgent.socialProfile.user_id}`);
              cy.wait(300);
            });
          });

          it('displays teams in a table', () => {
            cy.get('h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('#teams-table button span span').should('not.exist');
            cy.get('#teams-table table thead tr th').contains('Name');
            cy.get('#teams-table table tbody tr td').contains(organizerAgent.socialProfile.user_metadata.teams[0].name);
            cy.get('#teams-table table tbody tr td a').should('contain', organizerAgent.socialProfile.user_metadata.teams[0].name).
              and('have.attr', 'href').and('equal', `#team/${organizerAgent.socialProfile.user_metadata.teams[0].id}`);
            cy.get('#teams-table table thead tr th').contains('Leader');
            cy.get('#teams-table table tbody tr td').contains(organizerAgent.socialProfile.user_metadata.teams[0].leader);
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

    describe('viewing your own profile', () => {

      let agent;
      beforeEach(() => {
        cy.login('someguy@example.com', _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];

          // Make this agent an organizer
          cy.request('POST', `https://localhost:3002/api/v2/users/${agent.socialProfile.user_id}/roles`, { roles: ['123'] });
          cy.wait(300);

          cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
          cy.wait(500);
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);
      });

      it('displays agent\'s info', () => {
        cy.get('h3').contains('Profile');
        cy.get('#profile-table table tbody tr th').contains('Name:');
        cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.name);
        cy.get('#profile-table table tbody tr th').contains('Email:');
        cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.email);
        cy.get('#profile-table table tbody tr th').contains('Locale:');
        cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.locale);
        cy.get('#profile-table table tbody tr th').contains('Roles:');
        cy.get('#profile-table table tbody tr ul li').its('length').should('eq', 2);
        cy.get('#profile-table table tbody tr ul li').contains('organizer');
        cy.get('#profile-table table tbody tr ul li').contains('viewer');
        cy.get('#profile-table table tbody tr ul li #assign-role').should('not.exist');
      });

      describe('organizations', () => {
        describe('none created', () => {
          it('displays organizations table', () => {
            cy.get('#organizations-table h6').contains('Organizations');
            cy.get('#organizations-table table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          beforeEach(() => {
            cy.login('someguy@example.com', {..._profile, user_metadata: {
                                              organizations: [
                                                {
                                                  id: 'some-uuid-v4',
                                                  name: 'The National Lacrosse League',
                                                  organizer: 'someguy@example.com',
                                                }
                                              ]
                                            } });

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
              agent = results[0];

              cy.visit(`/#/agent/${agent.socialProfile.user_id}`);

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
        it('displays add-team button', () => {
          cy.get('#teams-table button span span').contains('add_box');
        });

        describe('none created', () => {
          it('displays teams table', () => {
            cy.get('h6').contains('Teams');
            cy.get('#teams-table table tbody tr td').contains('No records to display');
          });
        });

        describe('some created', () => {
          let agent;
          beforeEach(() => {
            cy.login('someguy@example.com', {..._profile, user_metadata: {
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
              cy.wait(400);
            });
          });

          it('displays teams in a table', () => {
            cy.get('h6').contains('Teams');
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

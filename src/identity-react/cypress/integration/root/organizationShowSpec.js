context('root/Organization show', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('authenticated', () => {

    let organizationId, teamId, root, leader;
    beforeEach(() => {
      organizationId = 'some-organization-uuid-v4';
      teamId = 'some-team-uuid-v4';

      // Team leader
      cy.login('coach@example.com', {..._profile, name: 'Curt Malawsky',
                                      user_metadata: {
                                        teams: [
                                          {
                                            id: teamId,
                                            name: 'The Calgary Roughnecks',
                                            leader: 'coach@example.com',
                                            organizationId: organizationId,
                                          }
                                        ]
                                      }
                                    });

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='coach@example.com' LIMIT 1;`).then(([results, metadata]) => {
        leader = results[0];


        // Get root agent
        cy.login(_profile.email, _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          root = results[0];
        });
      });
    });

    it('doesn\'t barf if organization doesn\'t exist', () => {
      cy.visit('/#/organization/333');
      cy.get('#error-message').contains('No such organization');
    });

    context('root is organizer', () => {
      beforeEach(() => {
        /**
         * 2020-7-8
         *
         * This harkens back to the question of whether a root agent can
         * create teams/orgs on behalf of another agent. Likewise, should
         * a root agent be able to create an org when admin mode is
         * enabled?
         */
        // The '123' role ID matches that defined in the RBAC mock server
        cy.request('POST', `https://localhost:3002/api/v2/users/${root.socialProfile.user_id}/roles`, { roles: ['123'] });

        cy.login(root.email, {..._profile, user_metadata: {
                                                 organizations: [
                                                   {
                                                     id: organizationId,
                                                     name: 'The National Lacrosse League',
                                                     organizer: root.email,
                                                   }
                                                 ]
                                               } });

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${root.email}' LIMIT 1;`).then(([results, metadata]) => {
          root = results[0];
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The National Lacrosse League').click();
            cy.wait(300);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/organization/${organizationId}`);
          });

          it('displays appropriate Organization interface elements', () => {
            cy.get('h3').contains('Organization');
            cy.get('#org-profile-info tbody tr td input#org-name-field').should('have.value', root.socialProfile.user_metadata.organizations[0].name);
            cy.get('#org-profile-info tbody tr td').contains(_profile.email);
            cy.get('button#delete-org').should('exist');
            cy.get('button#save-org').should('not.exist');
            cy.get('button#cancel-org-changes').should('not.exist');
          });

          it('displays member teams in a table', () => {
            cy.get('#member-teams-table h6').contains('Teams');
            cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('#member-teams-table button span span').contains('add_box').should('not.exist');

            cy.get('#member-teams-table table thead tr th').contains('Name');
            cy.get('#member-teams-table table thead tr th').contains('Leader');

            cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('exist');
            cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
              .should('contain', leader.socialProfile.user_metadata.teams[0].name)
              .and('have.attr', 'href')
              .and('equal', `#team/${leader.socialProfile.user_metadata.teams[0].id}`);
            cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(leader.email);
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The National Lacrosse League').click();
            cy.wait(300);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/organization/${organizationId}`);
          });

          it('displays appropriate Organization interface elements', () => {
            cy.get('h3').contains('Organization');
            cy.get('#org-profile-info tbody tr td input#org-name-field').should('have.value', root.socialProfile.user_metadata.organizations[0].name);
            cy.get('#org-profile-info tbody tr td').contains(_profile.email);
            cy.get('button#delete-org').should('exist');
            cy.get('button#save-org').should('not.exist');
            cy.get('button#cancel-org-changes').should('not.exist');
          });

          it('displays member teams in a table', () => {
            cy.get('#member-teams-table h6').contains('Teams');
            cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('#member-teams-table button span span').contains('add_box').should('not.exist');

            cy.get('#member-teams-table table thead tr th').contains('Name');
            cy.get('#member-teams-table table thead tr th').contains('Leader');

            cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('exist');
            cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
              .should('contain', leader.socialProfile.user_metadata.teams[0].name)
              .and('have.attr', 'href')
              .and('equal', `#team/${leader.socialProfile.user_metadata.teams[0].id}`);
            cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(leader.email);
          });
        });
      });
    });

    context('root is unaffiliated', () => {
      describe('admin mode', () => {
        let organizer;
        beforeEach(() => {
          cy.login('organizer@example.com', {..._profile, name: 'Nick Sakiewicz', user_metadata: {
                                                   organizations: [
                                                     {
                                                       id: organizationId,
                                                       name: 'The National Lacrosse League',
                                                       organizer: 'organizer@example.com',
                                                     }
                                                   ]
                                                 } });

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='organizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
            organizer = results[0];

            // The '123' role ID matches that defined in the RBAC mock server
            cy.request('POST', `https://localhost:3002/api/v2/users/${organizer.socialProfile.user_id}/roles`, { roles: ['123'] });
          });
        });

        context('switched on', () => {

          beforeEach(() => {
            cy.login(root.email, _profile);

            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Agent Directory').click();
            cy.wait(200);
            cy.contains(organizer.name).click();
            cy.wait(300);
            cy.contains('The National Lacrosse League').click();
            cy.wait(300);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/organization/${organizationId}`);
          });

          it('displays appropriate Organization interface elements', () => {
            cy.get('h3').contains('Organization');
            cy.get('#org-profile-info tbody tr td input#org-name-field').should('have.value', organizer.socialProfile.user_metadata.organizations[0].name);
            cy.get('#org-profile-info tbody tr td').contains(organizer.email);
            cy.get('button#delete-org').should('exist');
            cy.get('button#save-org').should('not.exist');
            cy.get('button#cancel-org-changes').should('not.exist');
          });

          it('displays member teams in a table', () => {
            cy.get('#member-teams-table h6').contains('Teams');
            cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('not.exist');
            cy.get('#member-teams-table button span span').contains('add_box').should('not.exist');

            cy.get('#member-teams-table table thead tr th').contains('Name');
            cy.get('#member-teams-table table thead tr th').contains('Leader');

            cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('exist');
            cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
              .should('contain', leader.socialProfile.user_metadata.teams[0].name)
              .and('have.attr', 'href')
              .and('equal', `#team/${leader.socialProfile.user_metadata.teams[0].id}`);
            cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(leader.email);
          });
        });

        /**
         * There is no admin toggle applicable to the organization route. As
         * such, the GET request will be fulfilled, but the root agent will not
         * have root abilities.
         */
        context('switched off', () => {
          beforeEach(() => {
            cy.login(root.email, _profile);
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.visit(`/#/organization/${organizationId}`);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/organization/${organizationId}`);
          });

          it('displays appropriate Organization interface elements', () => {
            cy.get('h3').contains('Organization');
            cy.get('#org-profile-info tbody tr td input#org-name-field').should('have.value', organizer.socialProfile.user_metadata.organizations[0].name);
            cy.get('#org-profile-info tbody tr td').contains(organizer.email);
            cy.get('button#delete-org').should('not.exist');
            cy.get('button#save-org').should('not.exist');
            cy.get('button#cancel-org-changes').should('not.exist');
          });
        });
      });
    });
  });
});

export {}

context('root/Team show', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/team/1');
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

    let root, regularAgent, teamId;
    beforeEach(function() {
      teamId = 'some-uuid-v4';

      // Create another team member
      cy.login('regularguy@example.com', {..._profile, user_metadata: {
                                              teams: [
                                                {
                                                  id: teamId,
                                                  name: 'The Calgary Roughnecks',
                                                  leader: 'regularguy@example.com',
                                                }
                                              ]
                                            }, name: 'Regular Guy' });

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        regularAgent = results[0];

        // Login root
        cy.login(_profile.email, _profile);

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          root = results[0];
          cy.reload(true);
          cy.wait(300);
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
    });

    describe('root is not a team member', () => {
      describe('admin mode', () => {
        context('switched on', () => {

          beforeEach(() => {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.contains('Agent Directory').click();
            cy.wait(200);
            cy.contains(regularAgent.name).click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${teamId}`);
          });

          it('displays common Team interface elements', () => {
            cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 2);
            cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
            cy.get('#team-profile-info tbody tr td').contains(regularAgent.email);
            cy.get('button#delete-team').should('exist');
            cy.get('button#save-team').should('not.exist');
            cy.get('button#cancel-team-changes').should('not.exist');
          });

          it('displays the members list with editable components', function() {
            // Admin cannot add an agent
            cy.get('#members-table div:first-of-type div div:last-of-type span').not('button');

            // Team leader cannot be deleted
            cy.get('#members-table table tbody tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table table tbody tr:nth-of-type(1) td a').should('contain', regularAgent.name).
                  and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table table tbody tr:nth-of-type(1) td').contains(regularAgent.socialProfile.user_metadata.teams[0].leader);
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.visit(`/#/team/${teamId}`);
            cy.wait(200);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${teamId}`);
          });

          it('tells you what\'s up', () => {
            cy.contains('You are not a member of that team');
          });
        });
      });
    });

    describe('root is a team member', () => {
      beforeEach(function() {

        cy.login(root.email, {..._profile, user_metadata: {
                                    teams: [
                                      {
                                        id: teamId,
                                        name: 'The Calgary Roughnecks',
                                        leader: 'regularguy@example.com',
                                      }
                                    ]
                                  }});

      });

      describe('admin mode', () => {
        context('switched on', () => {

          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.wait(200);
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${teamId}`);
          });

          it('displays common Team interface elements', () => {
            cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 2);
            cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
            cy.get('#team-profile-info tbody tr td').contains(regularAgent.email);
            cy.get('button#delete-team').should('exist');
            cy.get('button#save-team').should('not.exist');
            cy.get('button#cancel-team-changes').should('not.exist');
          });

          it('displays the members list with editable components', () => {
            // Admin cannot add an agent (add-agent-button)
            cy.get('#members-table div:first-of-type div div:last-of-type span').not('button');;

            // Team leader still cannot be deleted
            cy.get('#members-table table tbody tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table table tbody tr:nth-of-type(1) td a').should('contain', regularAgent.name).
                  and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table table tbody tr:nth-of-type(1) td').contains(regularAgent.socialProfile.user_metadata.teams[0].leader);
            // Root agent can be deleted
            cy.get('#members-table table tbody tr:nth-of-type(2) button[title=Delete]').should('exist');
            cy.get('#members-table table tbody tr:nth-of-type(2) td a').should('contain', root.name).
                and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table table tbody tr:nth-of-type(2) td').contains(root.socialProfile.email);
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.wait(200);
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(300);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(300);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${teamId}`);
          });

          it('displays common Team interface elements', () => {
            cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 2);
            cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
            cy.get('#team-profile-info tbody tr td').contains(regularAgent.email);
            cy.get('button#delete-team').should('not.exist');
            cy.get('button#save-team').should('not.exist');
            cy.get('button#cancel-team-changes').should('not.exist');
          });

          it('displays the members list without editable components', () => {
            // Admin not enabled, can't add agent
            cy.get('#members-table button span span').should('not.exist');

            // Team leader cannot be deleted
            cy.get('#members-table table tbody tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table table tbody tr:nth-of-type(1) td a').should('contain', regularAgent.name).
                  and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table table tbody tr:nth-of-type(1) td').contains(regularAgent.socialProfile.user_metadata.teams[0].leader);
            // Member agent cannot be deleted
            cy.get('#members-table table tbody tr:nth-of-type(2) button[title=Delete]').should('not.exist');
            cy.get('#members-table table tbody tr:nth-of-type(2) td a').should('contain', root.name).
                and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table table tbody tr:nth-of-type(2) td').contains(root.socialProfile.email);
          });
        });
      });
    });
  });
});

export {}

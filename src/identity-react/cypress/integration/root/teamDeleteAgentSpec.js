context('root/Team delete agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Teams" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "organization_team" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "TeamMembers" CASCADE;');
  });

  describe('Deleting agent from team', () => {

    let root, regularAgent, organization, team;
    beforeEach(function() {
      // Login/create regular agent
      cy.login('regularguy@example.com', _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        regularAgent = results[0];
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'National Lacrosse League' } }).then((org) => {
          organization = org.body;

          cy.login(_profile.email, _profile);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });
      });
    });

    describe('root\'s own team', () => {

      describe('when an organization member', () => {
        beforeEach(function() {
          cy.login(regularAgent.email, _profile);

          // Add root as member
          cy.request({ url: '/organization', method: 'PATCH', body: { id: organization.id, memberId: root.id } }).then((res) => {

            // Verify root membership
            cy.task('query', `UPDATE "OrganizationMembers" SET "verificationCode"=null WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {

              // Login root and create team
              cy.login(root.email, _profile);
              cy.request({ url: '/team',  method: 'POST',
                           body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
                team = res.body;

                // Add agent to team
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: 'somenewguy@example.com' } });
                cy.wait(500);
              });
            });
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
            });

            it('updates the interface', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('.delete-member').first().click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
            });

            it('updates the database', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(2);
                cy.get('.delete-member').first().click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                });
              });
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(organization.name).click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
            });

            it('updates the interface', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('.delete-member').first().click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
            });

            it('updates the database', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(2);
                cy.get('.delete-member').first().click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                });
              });
            });
          });
        });
      });

      describe('when not an organization member', () => {
        beforeEach(function() {
          // Login root and create team
          cy.login(root.email, _profile);
          cy.request({ url: '/team',  method: 'POST',
                       body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
            team = res.body;
            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: 'somenewguy@example.com' } });
            cy.wait(500);
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
            });

            it('updates the interface', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('.delete-member').first().click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
            });

            it('updates the database', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(2);
                cy.get('.delete-member').first().click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                });
              });
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(organization.name).should('not.exist');
              cy.visit(`/#/team/${team.id}`);
              cy.wait(500);
            });
          });

          // A root agent is still a root agent. The only thing contstraining
          // the root agent from changing data is the interface itself.
          it('does not display any delete buttons', () => {
            cy.get('button#delete-member').should('not.exist');
          });
        });
      });
    });

    describe('team created by a regular agent', () => {
      describe('when root is an organization member', () => {
        beforeEach(function() {
          cy.login(regularAgent.email, _profile);

          // Add root as member
          cy.request({ url: '/organization', method: 'PATCH', body: { id: organization.id, memberId: root.id } }).then((res) => {

            // Verify root membership
            cy.task('query', `UPDATE "OrganizationMembers" SET "verificationCode"=null WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {

              // Create team
              cy.request({ url: '/team',  method: 'POST',
                           body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
                team = res.body;

                // Add agent to team
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: 'somenewguy@example.com' } }).then(res => {

                  // Login root
                  cy.login(root.email, _profile);
                });
              });
            });
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
            });

            it('updates the interface', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('.delete-member').first().click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
            });

            it('updates the database', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(2);
                cy.get('.delete-member').first().click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                });
              });
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(organization.name).click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
            });

            // A root agent is still a root agent. The only thing contstraining
            // the root agent from changing data is the interface itself.
            it('does not display any delete buttons', () => {
              cy.get('.delete-member').should('not.exist');
            });
          });
        });
      });

      describe('when root is not an organization member', () => {
        beforeEach(function() {
          cy.login(regularAgent.email, _profile);

          // Create team
          cy.request({ url: '/team',  method: 'POST',
                       body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
            team = res.body;

            // Add agent to team
            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: 'somenewguy@example.com' } }).then(res => {

              // Login root
              cy.login(root.email, _profile);
            });
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
            });

            it('updates the interface', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
              cy.get('.delete-member').first().click();
              cy.wait(500);
              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
            });

            it('updates the database', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                expect(results.length).to.eq(2);
                cy.get('.delete-member').first().click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                });
              });
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(organization.name).should('not.exist');
              cy.visit(`/#/team/${team.id}`);
              cy.wait(500);
            });

            // A root agent is still a root agent. The only thing contstraining
            // the root agent from changing data is the interface itself.
            it('does not display any delete buttons', () => {
              cy.get('.delete-member').should('not.exist');
            });
          });
        });
      });
    });
  });
});

export {}

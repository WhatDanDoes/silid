context('root/Team edit', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  describe('Editing', () => {

    let root, regularAgent, organization, team;
    beforeEach(function() {
      // Login/create regular agent
      cy.login('regularguy@example.com', _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        regularAgent = results[0];
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'Roots' } }).then((org) => {
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
                           body: { organizationId: organization.id, name: 'The Mike Tyson Mystery Team' } }).then(res => {
                team = res.body;
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
              cy.get('button#edit-team').click();
            });

            it('updates the record in the database', function() {
              cy.get('input[name="name"][type="text"]').should('have.value', team.name);
              cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Teams" WHERE "id"='${team.id}' LIMIT 1;`).then(([results, metadata]) => {
                expect(results[0].name).to.eq('The Toronto Constabulary');
              });
            });

            it('updates the record on the interface', function() {
              cy.get('h3').contains(team.name);
              cy.get('input[name="name"][type="text"]').should('have.value', team.name);
              cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
              cy.get('button[type="submit"]').click();
              cy.get('h3').contains('The Toronto Constabulary');
              cy.get('button#edit-team').click();
              cy.get('input[name="name"][type="text"]').should('have.value', 'The Toronto Constabulary');
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
              cy.get('button#edit-team').click();
            });

            it('updates the record in the database', function() {
              cy.get('input[name="name"][type="text"]').should('have.value', team.name);
              cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Teams" WHERE "id"='${team.id}' LIMIT 1;`).then(([results, metadata]) => {
                expect(results[0].name).to.eq('The Toronto Constabulary');
              });
            });

            it('updates the record on the interface', function() {
              cy.get('h3').contains(team.name);
              cy.get('input[name="name"][type="text"]').should('have.value', team.name);
              cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
              cy.get('button[type="submit"]').click();
              cy.get('h3').contains('The Toronto Constabulary');
              cy.get('button#edit-team').click();
              cy.get('input[name="name"][type="text"]').should('have.value', 'The Toronto Constabulary');
            });
          });
        });
      });

      describe('when not an organization member', () => {
        beforeEach(function() {
          cy.login(root.email, _profile);
          cy.request({ url: '/team',  method: 'POST',
                       body: { organizationId: organization.id, name: 'The Mike Tyson Mystery Team' } }).then(res => {
            team = res.body;
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            beforeEach(function() {
              cy.visit('/#/').then(() => {
                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.contains('Team Directory').click();
                cy.wait(500);
                cy.contains(team.name).click();
                cy.wait(500);
                cy.get('button#edit-team').click();
              });
            });

            it('updates the record in the database', function() {
              cy.get('input[name="name"][type="text"]').should('have.value', team.name);
              cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Teams" WHERE "id"='${team.id}' LIMIT 1;`).then(([results, metadata]) => {
                expect(results[0].name).to.eq('The Toronto Constabulary');
              });
            });

            it('updates the record on the interface', function() {
              cy.get('h3').contains(team.name);
              cy.get('input[name="name"][type="text"]').should('have.value', team.name);
              cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
              cy.get('button[type="submit"]').click();
              cy.get('h3').contains('The Toronto Constabulary');
              cy.get('button#edit-team').click();
              cy.get('input[name="name"][type="text"]').should('have.value', 'The Toronto Constabulary');
            });
          });

          context('switched off', () => {
            beforeEach(function() {
              cy.visit('/#/').then(() => {
                cy.get('#app-menu-button').click();
                cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
                cy.get('#organization-button').click();
                cy.wait(500);
                cy.contains(team.name).should('not.exist');
                cy.wait(500);
                cy.visit(`/#/team/${team.id}`);
                cy.wait(500);
                cy.get('button#edit-team').click();
              });
            });

            it('updates the record in the database', function() {
              cy.get('input[name="name"][type="text"]').should('have.value', team.name);
              cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Teams" WHERE "id"='${team.id}' LIMIT 1;`).then(([results, metadata]) => {
                expect(results[0].name).to.eq('The Toronto Constabulary');
              });
            });

            it('updates the record on the interface', function() {
              cy.get('h3').contains(team.name);
              cy.get('input[name="name"][type="text"]').should('have.value', team.name);
              cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
              cy.get('button[type="submit"]').click();
              cy.get('h3').contains('The Toronto Constabulary');
              cy.get('button#edit-team').click();
              cy.get('input[name="name"][type="text"]').should('have.value', 'The Toronto Constabulary');
            }); 
          });
        });
      });
    });

    describe('a team created by a regular agent', () => {

      beforeEach(function() {
        // Create team with regular agent
        cy.login(regularAgent.email, _profile);
        cy.request({ url: '/team', method: 'POST', body: { organizationId: organization.id, name: 'The K-Team' } }).then(res => {
          team = res.body;
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(function() {
            cy.login(root.email, _profile);
            cy.visit('/#/').then(() => {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Team Directory').click();
              cy.wait(500);
              cy.contains(team.name).click();
              cy.wait(500);
              cy.get('button#edit-team').click();
            });
          });

          it('updates the record in the database', function() {
            cy.get('input[name="name"][type="text"]').should('have.value', team.name);
            cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
            cy.get('button[type="submit"]').click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "Teams" WHERE "id"='${team.id}' LIMIT 1;`).then(([results, metadata]) => {
              expect(results[0].name).to.eq('The Toronto Constabulary');
            });
          });

          it('updates the record on the interface', function() {
            cy.get('h3').contains(team.name);
            cy.get('input[name="name"][type="text"]').should('have.value', team.name);
            cy.get('input[name="name"][type="text"]').clear().type('The Toronto Constabulary');
            cy.get('button[type="submit"]').click();
            cy.get('h3').contains('The Toronto Constabulary');
            cy.get('button#edit-team').click();
            cy.get('input[name="name"][type="text"]').should('have.value', 'The Toronto Constabulary');
          });
        });

        context('switched off', () => {
          beforeEach(function() {
            cy.login(root.email, _profile);
            cy.visit('/#/').then(() => {
              cy.get('#app-menu-button').click();
              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
              cy.get('#organization-button').click();
              cy.wait(500);
              cy.contains(team.name).should('not.exist');
              cy.visit(`/#/team/${team.id}`);
              cy.wait(500);
            });
          });

          // A root agent is still a root agent. The only thing contstraining
          // the root agent from changing data is the interface itself.
          it('does not display the edit button', () => {
            cy.get('button#edit-team').should('not.exist');
          });
        });
      });
    });
  });
});

export {}

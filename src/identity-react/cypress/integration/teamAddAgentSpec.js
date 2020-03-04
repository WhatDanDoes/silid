// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Team add agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Why?
    _profile = {...this.profile};
  });

  context('authenticated', () => {

    let agent, anotherAgent;
    beforeEach(function() {
      // Login/create another agent
      cy.login('someotherguy@example.com', _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        anotherAgent = results[0];

        // Login/create main test agent
        cy.login(_profile.email, _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "agent_team" CASCADE;');
    });

    context('creator agent visit', () => {

      let organization, team;
      beforeEach(function() {
        cy.request({ url: '/organization', method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.request({ url: '/team',  method: 'POST',
                       body: { organizationId: organization.id, name: 'Calgary Roughnecks' } }).then(res => {
            team = res.body;

            cy.visit('/#/');
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
            cy.contains('One Book Canada').click();
            cy.contains('Calgary Roughnecks').click();
            cy.wait(500);
          });
        });
      });

      describe('add-agent button', () => {
        beforeEach(function() {
          cy.get('button#add-agent').click();
        });

        it('renders the add-agent input form correctly', () => {
          cy.get('button#add-agent').should('not.exist');
          cy.get('button#add-team').should('not.exist');
          cy.get('input[name="email"][type="email"]').should('exist');
          cy.get('button[type="submit"]').should('exist');
          cy.get('button#cancel-add-agent').should('exist');
        });

        describe('add-member-agent-form', () => {
          describe('cancel-add-agent button', () => {
            it('hides the add-member-agent-form', function() {
              cy.get('form#add-member-agent-form').should('exist');
              cy.get('button#cancel-add-agent').click();
              cy.get('form#add-member-agent-form').should('not.exist');
            });
  
            it('clears the email input field', function() {
              cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
              cy.get('button#cancel-add-agent').click();
              cy.get('button#add-agent').click();
              cy.get('input[name="email"][type="email"]').should('be.empty');
            });
          });

          describe('add-member-agent-button', () => {
            it('does not allow an empty field', function() {
              cy.get('input[name="email"][type="email"]').clear();
              cy.get('input[name="email"][type="email"]').type('     ');
              cy.get('input[name="email"][type="email"]').should('have.value', '');
              cy.get('button[type="submit"]').should('be.disabled');
            });

            it('does not allow an invalid email', function() {
              cy.get('input[name="email"][type="email"]').clear();
              cy.get('input[name="email"][type="email"]').type('this is not an email');
              cy.get('button[type="submit"]').click();
              cy.get('input[name="email"][type="email"]:invalid').should('have.length', 1)
              cy.get('input[name="email"][type="email"]:invalid').then($input => {
                expect($input[0].validationMessage).to.eq('email required')
              });
            });
      
            describe('unknown agent', () => {
              it('updates the record in the database', function() {
                cy.task('query', `SELECT * FROM "agent_team";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
                  cy.get('button[type="submit"]').click();
                  cy.wait(500);
                  cy.task('query', `SELECT * FROM "agent_team";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(2);
                  });
                });
              });

              it('creates agent record in the database', function() {
                cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
                  expect(results.length).to.eq(0);
                  cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
                  cy.get('button[type="submit"]').click();
                  cy.wait(500);
                  cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
                    expect(results.length).to.eq(1);
                  });
                });
              });
      
              it('hides the add-member-agent-form', function() {
                cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('form#add-member-agent-form').should('not.exist');
              });
  
              it('updates the record on the interface', function() {
                cy.get('#team-member-list').should('exist');
                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
                cy.get('#team-member-list .list-item').first().contains(agent.email);
                cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
                cy.get('#team-member-list .list-item').last().contains('somenewguy@example.com');
                cy.get('#team-member-list .team-button .delete-member').last().should('exist');
              });

              it('links to the new agent\'s profile page', () => {
                cy.get('input[name="email"][type="email"]').type('somenewguy@example.com');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.task('query', `SELECT * FROM "Agents" WHERE email='somenewguy@example.com';`).then(([results, metadata]) => {
                  cy.get('#team-member-list .list-item').last().should('have.attr', 'href').and('include', `#agent/${results[0].id}`)
                  cy.get('#team-member-list .list-item').last().click();
                  cy.url().should('contain', `/#/agent/${results[0].id}`);
                  cy.get('input[name="name"][type="text"]').should('have.value', '');
                  cy.get('input[name="email"][type="email"]').should('have.value', 'somenewguy@example.com');
                });
              });
            });

            describe('known agent', () => {
              it('updates the record in the database', function() {
                cy.task('query', `SELECT * FROM "agent_team";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].AgentId).to.eq(agent.id);
                  cy.get('input[name="email"][type="email"]').type(anotherAgent.email);
                  cy.get('button[type="submit"]').click();
                  cy.wait(500);
                  cy.task('query', `SELECT * FROM "agent_team";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(2);
                    expect(results[0].AgentId).to.eq(agent.id);
                    expect(results[1].AgentId).to.eq(anotherAgent.id);
                  });
                });
              });

              it('hides the add-member-agent-form', function() {
                cy.get('input[name="email"][type="email"]').type(anotherAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('form#add-member-agent-form').should('not.exist');
              });
  
              it('updates the record on the interface', function() {
                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
                cy.get('#team-member-list .list-item').first().contains(agent.email);
                cy.get('input[name="email"][type="email"]').type(anotherAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
                cy.get('#team-member-list .list-item').last().contains(anotherAgent.email);
                cy.get('#team-member-list .team-button .delete-member').last().should('exist');
              });

              it('links to the new agent\'s profile page', () => {
                cy.get('input[name="email"][type="email"]').type(anotherAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('#team-member-list .list-item').last().should('have.attr', 'href').and('include', `#agent/${anotherAgent.id}`)
                cy.get('#team-member-list .list-item').last().click();
                cy.url().should('contain', '/#/agent');
                cy.url().should('contain', `/#/agent/${anotherAgent.id}`);
                cy.get('input[name="name"][type="text"]').should('have.value', anotherAgent.name);
                cy.get('input[name="email"][type="email"]').should('have.value', anotherAgent.email);
              });
            });

            describe('erroneous additions', () => {

              it('shows an error message when a duplicate agent is added', () => {
                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
                cy.get('#team-member-list .list-item').first().contains(agent.email);

                cy.get('input[name="email"][type="email"]').type(anotherAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
                cy.get('#team-member-list .list-item').last().contains(anotherAgent.email);

                // Add same agent
                cy.get('button#add-agent').click();
                cy.get('input[name="email"][type="email"]').type(anotherAgent.email);
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
                cy.contains(`${anotherAgent.email} is already a member of this team`);
              });
            });
          });
        });
      });
    });

    context('verified member agent visit', () => {

      let organization, team;
      beforeEach(function() {
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: anotherAgent.id } }).then((res) => {

            // Verify agent membership
            cy.task('query', `UPDATE "OrganizationMembers" SET "verificationCode"=null WHERE "AgentId"=${anotherAgent.id};`).then(([results, metadata]) => {

              cy.request({ url: '/team',  method: 'POST',
                           body: { organizationId: organization.id, name: 'Calgary Roughnecks' } }).then(res => {
                team = res.body;

                cy.login(anotherAgent.email, _profile);
                cy.visit('/#/');
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
                cy.contains('Calgary Roughnecks').click();
              });
            });
          });
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${team.id}`);
      });

      it('displays common Team interface elements', function() {
        cy.get('button#add-agent').should('not.exist');
        cy.get('button#add-team').should('not.exist');
      });
    });

    context('unverified member agent visit', () => {

      let organization, team;
      beforeEach(function() {
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: anotherAgent.id } }).then((res) => {
            cy.request({ url: '/team',  method: 'POST',
                         body: { organizationId: organization.id, name: 'Calgary Roughnecks' } }).then(res => {
              team = res.body;

              cy.login(anotherAgent.email, _profile);
              cy.visit('/#/');
              cy.get('#app-menu-button').click();
              cy.get('#organization-button').click();
              cy.contains('One Book Canada').click();
            });
          });
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/organization/${organization.id}`);
      });

      it('displays common Team interface elements', function() {
        cy.get('button#add-agent').should('not.exist');
        cy.get('button#add-team').should('not.exist');
        cy.contains('You have not verified your invitation to this organization. Check your email.');
      });
    });
  });
});

export {}

context('root/Agent Index', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/agent/admin');
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

    beforeEach(function() {
      cy.login(_profile.email, _profile);
    });

    context('admin mode', () => {

      context('cached mode', () => {

        context('switched on', () => {
          beforeEach(function() {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#show-cached-switch').check();
            cy.contains('Agent Directory').click();
          });

          it('lands in the right spot', () => {
            cy.url().should('match', /\/#\/agent\/admin$/);
          });

          it('displays common Agent Directory interface elements', function() {
            cy.get('h3').contains('Directory');
          });

          describe('agent directory list', () => {
            context('no agents', () => {
              it('displays only the root agent', () => {
                cy.task('query', 'SELECT * FROM "Agents";').then(([results, metadata]) => {
                  expect(results.length).to.equal(1);
                  cy.get('#agent-list').should('exist');
                  cy.get('#agent-list').find('.agent-button').its('length').should('eq', 1);
                  cy.get('.agent-button').first().contains(results[0].name);
                  cy.get('.agent-button a').first().should('have.attr', 'href').and('include', `#agent/${results[0].id}`)
                });
              });
            });

            context('some agents', () => {

              let agents;
              beforeEach(function() {
                // Easy way to register a new agent
                cy.login('someotherguy@example.com', { ..._profile, name: 'Some Other Guy' }, [this.scope.read.agents]);
                cy.login(_profile.email, _profile);
                cy.task('query', 'SELECT * FROM "Agents" ORDER BY "name";').then(([results, metadata]) => {
                  agents = results;
                  expect(agents.length).to.equal(2);

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.get('#show-cached-switch').check();
                  cy.contains('Directory').click();
                });
              });

              it('displays the agents', () => {
                cy.get('#agent-list').should('exist');
                cy.get('#agent-list').find('.agent-button').its('length').should('eq', 2);
                cy.get('.agent-button').first().contains(agents[0].name);
                cy.get('.agent-button a').first().should('have.attr', 'href').and('include', `#agent/${agents[0].id}`);
                cy.get('.agent-button').last().contains(agents[1].name);
                cy.get('.agent-button a').last().should('have.attr', 'href').and('include', `#agent/${agents[1].id}`);
              });
            });
          });
        });

        context('switched off', () => {
          let agents;
          beforeEach(function() {
            // Easy way to register a new agent
            cy.login('someotherguy@example.com', { ..._profile, name: 'Some Other Guy' }, [this.scope.read.agents]);

            cy.login(_profile.email, _profile);
            cy.task('query', 'SELECT * FROM "Agents";').then(([results, metadata]) => {
              agents = results;

              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.get('#show-cached-switch').uncheck();
              cy.contains('Agent Directory').click();
            });
          });

          it('displays the agents', () => {
            cy.get('#agent-list').should('exist');
            cy.get('#agent-list').find('.agent-button').its('length').should('eq', 2);
            cy.get('.agent-button').first().contains(agents[0].name);
            cy.get('.agent-button').first().contains(agents[0].email);
            cy.get('.agent-button a').first().should('have.attr', 'href').and('include', `#agent/${agents[0].socialProfile.id}`);
            cy.get('.agent-button').last().contains(agents[1].name);
            cy.get('.agent-button').last().contains(agents[1].email);
            cy.get('.agent-button a').last().should('have.attr', 'href').and('include', `#agent/${agents[1].socialProfile.id}`);
          });

          it('does not display the paging button', () => {
            cy.get('.pager').should('not.exist');
          });
        });
      });
    });
  });

  describe('unauthorized', done => {
    beforeEach(function() {
      cy.login('someotherguy@example.com', { ..._profile, name: 'Some Other Guy' }, [this.scope.read.agents]);
    });

    it('displays a friendly message', () => {
      cy.visit(`/#/agent/admin`);
      cy.wait(500);
      cy.contains('Insufficient scope');
    });
  });
});

export {}

context('root/Agent Index', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
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

    it('enters with admin mode turned off', () => {
      cy.get('#app-menu-button').click();
      cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
      cy.get('#app-menu ul div:nth-of-type(5) a').should('not.exist');
    });

    it('allows the super agent to toggle admin mode', () => {
      cy.get('#app-menu-button').click();
      cy.get('#app-menu ul div:nth-of-type(5) a').should('not.exist');
      cy.get('#app-menu ul div:nth-of-type(4) input').check();
      cy.get('#app-menu ul div:nth-of-type(5) a').should('have.attr', 'href', '#agent/admin').and('contain', 'Directory');
      cy.get('#app-menu ul div:nth-of-type(4) input').uncheck();
      cy.get('#app-menu ul div:nth-of-type(5) a').should('not.exist');
    });

    context('admin mode', () => {

      beforeEach(function() {
        cy.get('#app-menu-button').click();
        cy.get('#admin-switch').check();
        cy.contains('Directory').click();
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
            cy.login('someotherguy@example.com', { ..._profile, name: 'Some Other Guy' });
            cy.login(_profile.email, _profile);
            cy.task('query', 'SELECT * FROM "Agents";').then(([results, metadata]) => {
              agents = results;
              expect(agents.length).to.equal(2);

              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.contains('Directory').click();
            });
          });

          it('displays the agents', () => {
            cy.get('#agent-list').should('exist');
            cy.get('#agent-list').find('.agent-button').its('length').should('eq', 2);
            cy.get('.agent-button').first().contains(agents[0].name);
            cy.get('.agent-button a').first().should('have.attr', 'href').and('include', `#agent/${agents[0].id}`)
            cy.get('.agent-button').last().contains(agents[1].name);
            cy.get('.agent-button a').last().should('have.attr', 'href').and('include', `#agent/${agents[1].id}`)
          });
        });
      });
    });
  });

  describe('unauthorized', done => {
    beforeEach(() => {
      cy.login('someotherguy@example.com', { ..._profile, name: 'Some Other Guy' });
    });

    it('displays a friendly message', () => {
      cy.visit(`/#/agent/admin`);
      cy.wait(500);
      cy.contains('Forbidden');
    });
  });
});

export {}

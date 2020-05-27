context('root/Team Index', function() {

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
      cy.visit('/#/team/admin');
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

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Teams" CASCADE;');
  });

  let root, organization;
  describe('authenticated', () => {

    beforeEach(function() {
      cy.login(_profile.email, _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        root = results[0];
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'Roots' } }).then(org => {
          organization = org.body;
        });
      });
    });

    context('admin mode', () => {

      beforeEach(function() {
        cy.get('#app-menu-button').click();
        cy.get('#admin-switch').check();
        cy.contains('Team Directory').click();
      });
 
      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/team');
      });
  
      it('displays common Team interface elements', function() {
        cy.get('h3').contains('Teams');
      });

      describe('team membership', () => {
        context('no teams', () => {
          it('displays no teams', () => {
            cy.task('query', 'SELECT * FROM "Teams";').then(([results, metadata]) => {
              expect(results.length).to.equal(0);
              cy.get('#team-list').should('not.exist');
            });
          });
        });

        context('some teams', () => {
          let team;
          beforeEach(function() {
  
            // Add agent to organization membership (still logged in as root here)
            cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', body: { email: 'someotherguy@example.com' } }).then(res => {
  
              // Create a team with another agent
              cy.login('someotherguy@example.com', _profile, [this.scope.read.agents, this.scope.create.teams]);
  
              cy.request({ url: '/team',  method: 'POST', body: { organizationId: organization.id, name: 'The Mike Tyson Mystery Team' } }).then(res => {
                team = res.body;
  
                // Login member root
                cy.login(root.email, _profile);
                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.contains('Team Directory').click();
              });
            });
          });
  
          it('displays a list of teams', () => {
            cy.get('#team-list').should('exist');
            cy.get('#team-list').find('.team-button').its('length').should('eq', 1);
            cy.get('.team-button').first().contains(team.name);
            cy.get('.team-button a').first().should('have.attr', 'href').and('include', `#team/${team.id}`)
          });
        });
      });
    });
  });

  describe('unauthorized', done => {
    let team;
    beforeEach(function() {
      cy.login(_profile.email, _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        root = results[0];
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'Roots' } }).then(org => {
          organization = org.body;
          cy.request({ url: '/team',  method: 'POST', body: { organizationId: organization.id, name: 'The Mike Tyson Mystery Team' } }).then(res => {
            team = res.body;
     
            cy.login('someotherguy@example.com', { ..._profile, name: 'Some Other Guy' }, [this.scope.read.agents, this.scope.create.teams]);
          });
        });
      });
    });

    it('doesn\'t display any teams', () => {
      cy.visit(`/#/team/admin`);
      cy.wait(500);
      cy.get('#team-list').should('not.exist');
    });
  });
});

export {}

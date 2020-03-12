context('root/Team show', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
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
 
    let root, regularAgent, organization, team;
    beforeEach(function() {
      // Login/create another agent
      cy.login('regularguy@example.com', _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        regularAgent = results[0];

        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;

          cy.request({ url: '/team',  method: 'POST', body: { organizationId: organization.id, name: 'The Mike Tyson Mystery Team' } }).then(res => {
            team = res.body;
 
            // Login/create root agent
            cy.login(_profile.email, _profile);
            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
              root = results[0];
            });
          });
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Teams" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    });

    
    describe('root is not a team member', () => {
      describe('admin mode', () => {
        context('switched on', () => {
  
          beforeEach(function() {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.contains('Team Directory').click();
            cy.wait(500);
            cy.contains(team.name).click();
            cy.wait(500);
          });
  
          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${team.id}`);
          });
   
          it('displays common Team interface elements', function() {
            cy.get('h3').contains(team.name);
            cy.get('button#add-agent').should('exist');
            cy.get('button#edit-team').should('exist');
          });
        });
  
        context('switched off', () => {
          beforeEach(function() {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').should('not.be.checked'); // admin mode disabled
            cy.get('#team-button').click();
            cy.wait(500);
            cy.contains(team.name).should('not.exist');
            cy.visit(`/#/team/${team.id}`);
            cy.wait(500);
          });
  
          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${team.id}`);
          });
   
          it('displays common Team interface elements', function() {
            cy.get('button#add-agent').should('not.exist');
            cy.get('button#edit-team').should('not.exist');
          });
        });
      });
    });

    describe('root is a team member', () => {
      beforeEach(function() {
        cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: root.email } }).then(res => {

          // Verify agent membership
          cy.task('query', `UPDATE "TeamMembers" SET "verificationCode"=null WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {
            cy.login(root.email, _profile);
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
  
          beforeEach(function() {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#team-button').click();
            cy.wait(500);
            cy.contains(team.name).click();
            cy.wait(500);
          });
  
          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${team.id}`);
          });
   
          it('displays common Team interface elements', function() {
            cy.get('h3').contains(team.name);
            cy.get('button#add-agent').should('exist');
            cy.get('button#edit-team').should('exist');
          });
        });
  
        context('switched off', () => {
          beforeEach(function() {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').should('not.be.checked'); // admin mode disabled
            cy.get('#team-button').click();
            cy.wait(500);
            cy.contains(team.name).click();
            cy.wait(500);
          });
  
          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${team.id}`);
          });
   
          it('displays common Team interface elements', function() {
            cy.get('button#add-agent').should('not.exist');
            cy.get('button#edit-team').should('not.exist');
          });
        });
      });
    });
  });
});

export {}

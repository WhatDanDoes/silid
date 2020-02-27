context('Team', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Why?
    _profile = {...this.profile};
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/team');
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

    let agent;
    beforeEach(function() {
      cy.login(_profile.email, _profile);
      cy.get('#app-menu-button').click();
      cy.get('#team-button').click().then(() =>  {
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Teams" CASCADE;');
    });

    it('lands in the right spot', () => {
      cy.url().should('contain', '/#/team');
    });

    it('displays common Team interface elements', function() {
      cy.get('h3').contains('Teams');
      cy.get('button#add-team').should('exist');
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

          // Create an team with another agent
          cy.login('someotherguy@example.com', _profile);
          cy.request({ url: '/team',  method: 'POST', body: { name: 'Princess Patricia\'s Light Infantry' } }).then(res => {
            team = res.body;

            // Add member agent
            cy.request({ url: '/team', method: 'PATCH', body: { id: team.id, memberId: agent.id } }).then(res => {

              // Login member agent
              cy.login(_profile.email, _profile);
              cy.visit('/#/');
              cy.get('#app-menu-button').click();
              cy.get('#team-button').click();
            });
          });
        });

        it('displays a list of teams', () => {
          cy.get('#team-list').should('exist');
          cy.get('#team-list').find('.team-button').its('length').should('eq', 1);
          cy.get('.team-button').first().contains('One Book Canada');
          cy.get('.team-button a').first().should('have.attr', 'href').and('include', `#team/${team.id}`)
        });
      });
    });

    describe('team creator', () => {

      context('no teams created by this agent', () => {
        it('displays no teams', () => {
          cy.task('query', `SELECT * FROM "Teams" WHERE "creatorId"=${agent.id};`).then(([results, metadata]) => {;
            expect(results.length).to.equal(0);
            cy.get('#team-list').should('not.exist');
          });
        });
      });

      context('agent has created teams', () => {

        let team;
        beforeEach(function() {
          cy.request({ url: '/team',  method: 'POST', body: { name: 'Princess Patricia\'s Light Infantry' } }).then(res => {
            team = res.body;
            cy.visit('/#/');
            cy.get('#app-menu-button').click();
            cy.get('#team-button').click();
          });
        });

        it('displays a list of teams', () => {
          cy.request({ url: '/team',  method: 'GET' }).then(teams => {
            expect(teams.body.length).to.eq(1);

            cy.get('#team-list').should('exist');
            cy.get('#team-list').find('.team-button').its('length').should('eq', 1);
            cy.get('.team-button').first().contains('Princess Patricia\'s Light Infantry');
            cy.get('.team-button a').first().should('have.attr', 'href').and('include', `#team/${team.id}`)
          });
        });
      });
    });
  });
});

export {}

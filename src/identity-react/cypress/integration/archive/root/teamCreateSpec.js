context('root/Team creation', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  let organization, root;
  context('authenticated', () => {
    beforeEach(function() {
      cy.login(_profile.email, _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        root = results[0];
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then(org => {
          cy.visit('/#/').then(() => {
            organization = org.body;
          });
        });
      });
    });
  
    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Teams" CASCADE;');
    });

    describe('Creating', () => {
      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(function() {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#organization-button').click();
            cy.wait(500);
            cy.contains(organization.name).click();
            cy.wait(500);
            cy.get('button#add-team').click();
          });

          it('updates the record in the database', function() {
            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
              expect(results.length).to.eq(0);
              cy.get('input[name="name"][type="text"]').type('The Mike Tyson Mystery Team');
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Teams"`).then(([results, metadata]) => {;
                expect(results[0].name).to.eq('The Mike Tyson Mystery Team');
              });
            });
          });

          it('updates the record on the interface', function() {
            cy.get('#team-list').should('not.exist');
            cy.get('input[name="name"][type="text"]').type('The Mike Tyson Mystery Team');
            cy.get('button[type="submit"]').click();
            cy.wait(500);
            cy.get('#organization-team-list').find('.list-item').its('length').should('eq', 1);
            cy.get('#organization-team-list .list-item').first().contains('The Mike Tyson Mystery Team');
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
            cy.get('button#add-team').click();
          });

          it('updates the record in the database', function() {
            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
              expect(results.length).to.eq(0);
              cy.get('input[name="name"][type="text"]').type('The Mike Tyson Mystery Team');
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Teams"`).then(([results, metadata]) => {;
                expect(results[0].name).to.eq('The Mike Tyson Mystery Team');
              });
            });
          });

          it('updates the record on the interface', function() {
            cy.get('#team-list').should('not.exist');
            cy.get('input[name="name"][type="text"]').type('The Mike Tyson Mystery Team');
            cy.get('button[type="submit"]').click();
            cy.wait(500);
            cy.get('#organization-team-list').find('.list-item').its('length').should('eq', 1);
            cy.get('#organization-team-list .list-item').first().contains('The Mike Tyson Mystery Team');
          });
        });
      });
    });
  });
});

export {}
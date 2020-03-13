context('root/Organization edit', function() {

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
    let root, organization;

    describe('root\'s own organization', () => {
      beforeEach(function() {
        cy.login(_profile.email, _profile);
        cy.visit('/#/').then(() => {
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
    
            cy.request({ url: '/organization',  method: 'POST', body: { name: 'Roots' } }).then((org) => {
              organization = org.body;
              cy.get('#app-menu-button').click();
            });
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#admin-switch').check();
            cy.get('#organization-button').click();
            cy.contains('Roots').click();
            cy.wait(500);
            cy.get('button#edit-organization').click();
          });
    
          it('updates the record in the database', function() {
            cy.task('query', `SELECT * FROM "Organizations" WHERE "id"='${organization.id}' LIMIT 1;`).then(([results, metadata]) => {
              cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
              cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Organizations" WHERE "id"='${organization.id}' LIMIT 1;`).then(([results, metadata]) => {
                expect(results[0].name).to.eq('Two Testaments Canada');
              });
            });
          });
    
          it('updates the record on the interface', function() {
            cy.get('h3').contains(organization.name);
            cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
            cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
            cy.get('button[type="submit"]').click();
            cy.get('h3').contains('Two Testaments Canada');
            cy.get('button#edit-organization').click();
            cy.get('input[name="name"][type="text"]').should('have.value', 'Two Testaments Canada');
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
            cy.get('#organization-button').click();
            cy.contains('Roots').click();
            cy.wait(500);
            cy.get('button#edit-organization').click();
          });
    
          it('updates the record in the database', function() {
            cy.task('query', `SELECT * FROM "Organizations" WHERE "id"='${organization.id}' LIMIT 1;`).then(([results, metadata]) => {
              cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
              cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
              cy.get('button[type="submit"]').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Organizations" WHERE "id"='${organization.id}' LIMIT 1;`).then(([results, metadata]) => {
                expect(results[0].name).to.eq('Two Testaments Canada');
              });
            });
          });
    
          it('updates the record on the interface', function() {
            cy.get('h3').contains(organization.name);
            cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
            cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
            cy.get('button[type="submit"]').click();
            cy.get('h3').contains('Two Testaments Canada');
            cy.get('button#edit-organization').click();
            cy.get('input[name="name"][type="text"]').should('have.value', 'Two Testaments Canada');
          });
        });
      });
    });

    describe('an organization created by a regular agent', () => {

      beforeEach(function() {
        // Login/create regular agent
        cy.login('regularguy@example.com', _profile);
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then(org => {
          organization = org.body;

          // Login/create root
          cy.login(_profile.email, _profile);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
            cy.visit('/#/');
            cy.get('#app-menu-button').click();
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#admin-switch').check();
            cy.contains('Organization Directory').click();
            cy.contains(organization.name).click();
            cy.wait(500);
            cy.get('button#edit-organization').click();
          });
    
          it('updates the record in the database', function() {
            cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
            cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
            cy.get('button[type="submit"]').click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "Organizations" WHERE "id"='${organization.id}' LIMIT 1;`).then(([results, metadata]) => {
              expect(results[0].name).to.eq('Two Testaments Canada');
              expect(results[0].id).to.eq(organization.id);
            });
          });
    
          it('updates the record on the interface', function() {
            cy.get('h3').contains(organization.name);
            cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
            cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
            cy.get('button[type="submit"]').click();
            cy.get('h3').contains('Two Testaments Canada');
            cy.get('button#edit-organization').click();
            cy.get('input[name="name"][type="text"]').should('have.value', 'Two Testaments Canada');
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
            cy.get('#organization-button').click();
            cy.wait(500);
            cy.contains(organization.name).should('not.exist');
            cy.visit(`/#/organization/${organization.id}`);
            cy.wait(500);
          });

          // A root agent is still a root agent. The only thing contstraining
          // the root agent from changing data is the interface itself.
          it('does not display the edit button', () => {
            cy.get('button#edit-organization').should('not.exist');
          });
        });
      });
    });
  });
});

export {}

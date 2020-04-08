context('root/Agent Index Paging', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  before(function() {
    cy.visit('/');

    cy.login('root@example.com', {...this.profile, email: 'root@example.com'});

    for (let i = 0; i < 90; i++) {
      cy.request({ url: '/agent',  method: 'POST', body: { email: `agent${i}@example.com`, name: `Agent #${i}`} });
    }
  });

  after(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  describe('authenticated', () => {

    context('admin mode', () => {

      context('cached mode', () => {

        context('switched off', () => {

          describe('pages tonnes of agents', () => {

            beforeEach(() => {
              cy.task('query', 'SELECT * FROM "Agents";').then(([results, metadata]) => {
                expect(results.length).to.equal(91);

                cy.get('#app-menu-button').click();
                cy.wait(200);
                cy.get('#admin-switch').check();
                cy.get('#show-cached-switch').uncheck();
                cy.contains('Agent Directory').click();
                cy.wait(200);
              });
            });

            it('displays the paging button', () => {
              cy.get('.pager').its('length').should('eq', 2);
            });

            it('displays 30 agent entries', () => {
              cy.get('#agent-list').find('.agent-button').its('length').should('eq', 30);
            });
          });
        });
      });
    });
  });
});

export {}

context('root/Agent Index Paging', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');

    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  before(function() {
    cy.visit('/');

    cy.login('root@example.com', {...this.profile, email: 'root@example.com'});

    for (let i = 0; i < 90; i++) {
      cy.request({ url: '/agent',  method: 'POST', body: { email: `agent${i}@example.com`, name: `Agent #${i}`} });
    }

    cy.task('query', 'SELECT * FROM "Agents" ORDER BY "name";').then(([results, metadata]) => {
      expect(results.length).to.equal(91);

      cy.get('#app-menu-button').click();
      cy.wait(200);
      cy.get('#admin-switch').check();
      cy.contains('Agent Directory').click();
      cy.wait(200);
    });

  });

  after(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('authenticated', () => {

    context('admin mode', () => {

      context('switched on', () => {

        describe('pages tonnes of agents', () => {

          it('displays the paging button', () => {
            cy.get('.pager').its('length').should('eq', 2);
          });

          it('displays 30 agent entries', () => {
            cy.get('#agent-list').find('.agent-button').its('length').should('eq', 30);
          });

          it('displays 4 page buttons for 91 agent entries', () => {
            cy.get('.pager').first().find('ul li').its('length').should('eq', 6);
            cy.get('.pager').first().find('ul li:nth-child(1) button').should('be.disabled');
            cy.get('.pager').first().find('ul li:nth-child(2)').contains('1');
            cy.get('.pager').first().find('ul li:nth-child(3)').contains('2');
            cy.get('.pager').first().find('ul li:nth-child(4)').contains('3');
            cy.get('.pager').first().find('ul li:nth-child(5)').contains('4');
            cy.get('.pager').first().find('ul li:nth-child(6) button').should('not.be.disabled');

            cy.get('.pager').last().find('ul li').its('length').should('eq', 6);
            cy.get('.pager').last().find('ul li:nth-child(1) button').should('be.disabled');
            cy.get('.pager').last().find('ul li:nth-child(2)').contains('1');
            cy.get('.pager').last().find('ul li:nth-child(3)').contains('2');
            cy.get('.pager').last().find('ul li:nth-child(4)').contains('3');
            cy.get('.pager').last().find('ul li:nth-child(5)').contains('4');
            cy.get('.pager').last().find('ul li:nth-child(6) button').should('not.be.disabled');
          });

          describe('paging forward', () => {
            beforeEach(function() {
              cy.login('root@example.com', {...this.profile, email: 'root@example.com'});
              cy.get('#app-menu-button').click();
              cy.wait(200);
              cy.get('#admin-switch').check();
              cy.contains('Agent Directory').click();
              cy.wait(200);
            });

            it('allows navigation to the end of the directory', () => {
              // Page 2
              cy.get('.pager').last().find('ul li:nth-child(6) button').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-list').find('.agent-button').its('length').should('eq', 30);

              // Pager component
              cy.get('.pager').first().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').first().find('ul li:nth-child(3) button.Mui-selected').contains('2');
              cy.get('.pager').first().find('ul li:nth-child(6) button').should('not.be.disabled');

              cy.get('.pager').last().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').last().find('ul li:nth-child(3) button.Mui-selected').contains('2');
              cy.get('.pager').last().find('ul li:nth-child(6) button').should('not.be.disabled');

              // Page 3
              cy.get('.pager').last().find('ul li:nth-child(6) button').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-list').find('.agent-button').its('length').should('eq', 30);

              // Pager component
              cy.get('.pager').first().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').first().find('ul li:nth-child(4) button.Mui-selected').contains('3');
              cy.get('.pager').first().find('ul li:nth-child(6) button').should('not.be.disabled');

              cy.get('.pager').last().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').last().find('ul li:nth-child(4) button.Mui-selected').contains('3');
              cy.get('.pager').last().find('ul li:nth-child(6) button').should('not.be.disabled');

              // Page 4
              cy.get('.pager').last().find('ul li:nth-child(6) button').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-list').find('.agent-button').its('length').should('eq', 1);

              // Pager component
              cy.get('.pager').first().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').first().find('ul li:nth-child(5) button.Mui-selected').contains('4');
              cy.get('.pager').first().find('ul li:nth-child(6) button').should('be.disabled');

              cy.get('.pager').last().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').last().find('ul li:nth-child(5) button.Mui-selected').contains('4');
              cy.get('.pager').last().find('ul li:nth-child(6) button').should('be.disabled');
            });
          });


          describe('paging backwards', () => {
            beforeEach(function() {
              cy.login('root@example.com', {...this.profile, email: 'root@example.com'});
              cy.get('#app-menu-button').click();
              cy.wait(200);
              cy.get('#admin-switch').check();
              cy.contains('Agent Directory').click();
              cy.wait(200);
              cy.get('.pager').first().find('ul li:nth-child(5) button').contains('4').click();
              cy.wait(200);
            });

            it('allows navigation to the beginning of the directory', () => {
              // Page 4
              // Listing count
              cy.get('#agent-list').find('.agent-button').its('length').should('eq', 1);

              // Pager component
              cy.get('.pager').first().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').first().find('ul li:nth-child(5) button.Mui-selected').contains('4');
              cy.get('.pager').first().find('ul li:nth-child(6) button').should('be.disabled');

              cy.get('.pager').last().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').last().find('ul li:nth-child(5) button.Mui-selected').contains('4');
              cy.get('.pager').last().find('ul li:nth-child(6) button').should('be.disabled');

              // Page 3
              cy.get('.pager').first().find('ul li:nth-child(1) button').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-list').find('.agent-button').its('length').should('eq', 30);

              // Pager component
              cy.get('.pager').first().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').first().find('ul li:nth-child(4) button.Mui-selected').contains('3');
              cy.get('.pager').first().find('ul li:nth-child(6) button').should('not.be.disabled');

              cy.get('.pager').last().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').last().find('ul li:nth-child(4) button.Mui-selected').contains('3');
              cy.get('.pager').last().find('ul li:nth-child(6) button').should('not.be.disabled');

              // Page 2
              cy.get('.pager').first().find('ul li:nth-child(1) button').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-list').find('.agent-button').its('length').should('eq', 30);

              // Pager component
              cy.get('.pager').first().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').first().find('ul li:nth-child(3) button.Mui-selected').contains('2');
              cy.get('.pager').first().find('ul li:nth-child(6) button').should('not.be.disabled');

              cy.get('.pager').last().find('ul li:nth-child(1) button').should('not.be.disabled');
              cy.get('.pager').last().find('ul li:nth-child(3) button.Mui-selected').contains('2');
              cy.get('.pager').last().find('ul li:nth-child(6) button').should('not.be.disabled');

              // Page 1
              cy.get('.pager').first().find('ul li:nth-child(1) button').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-list').find('.agent-button').its('length').should('eq', 30);

              // Pager component
              cy.get('.pager').first().find('ul li:nth-child(1) button').should('be.disabled');
              cy.get('.pager').first().find('ul li:nth-child(2) button.Mui-selected').contains('1');
              cy.get('.pager').first().find('ul li:nth-child(6) button').should('not.be.disabled');

              cy.get('.pager').last().find('ul li:nth-child(1) button').should('be.disabled');
              cy.get('.pager').last().find('ul li:nth-child(2) button.Mui-selected').contains('1');
              cy.get('.pager').last().find('ul li:nth-child(6) button').should('not.be.disabled');
            });
          });
        });
      });
    });
  });
});

export {}

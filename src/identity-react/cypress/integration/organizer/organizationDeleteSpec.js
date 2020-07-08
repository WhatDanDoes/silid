context('organizer/Organization delete', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  let _profile, agent;
  beforeEach(function() {
    _profile = {...this.profile};

    cy.login(_profile.email, _profile);

    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
      agent = results[0];

      // The '123' role ID matches that defined in the RBAC mock server
      cy.request('POST', `https://localhost:3002/api/v2/users/${agent.socialProfile.user_id}/roles`, { roles: ['123'] });

      cy.login(_profile.email, _profile, [this.scope.create.organizations, this.scope.delete.organizations]);

      cy.get('#organizations-table button span span').contains('add_box').click();
      cy.get('#organizations-table input[placeholder="Name"]').type('The National Lacrosse League');
      cy.get('#organizations-table button[title="Save"]').click();
      cy.wait(300);
  
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        agent = results[0];
      });
    });
  });

  describe('Deleting', () => {

    describe('successfully', () => {

      context('when organization has member teams', () => {
        beforeEach(function() {
          // Create a member team
          cy.login('player@example.com', {..._profile, user_metadata: {
                                                     teams: [
                                                       {
                                                         id: 'some-team-uuid-v4',
                                                         name: 'The Calgary Roughnecks',
                                                         leader: 'coach@example.com',
                                                         organizationId: agent.socialProfile.user_metadata.organizations[0].id,
                                                       }
                                                     ]
                                                   }, name: 'Tracey Kelusky' });
          // Login organizer agent
          cy.login(_profile.email, _profile, [this.scope.create.organizations, this.scope.delete.organizations]);

          cy.contains('The National Lacrosse League').click();
          cy.wait(300);
        });

        it('does not allow deletion', done => {
          cy.on('window:alert', (str) => {
            expect(str).to.eq('Remove all member teams before deleting the organization');
            done();
          });
          cy.get('#delete-org').click();
        });
      });

//      context('when team has pending invitations', () => {
//        beforeEach(function() {
//          // Login/create main test agent
//          cy.login(_profile.email, _profile);
//
//          cy.contains('The A-Team').click();
//          cy.wait(300);
//
//          // Invite agent to team
//          cy.get('button span span').contains('add_box').click();
//          cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
//          cy.get('button[title="Save"]').click();
//          cy.wait(300);
//        });
//
//        it('does not allow deletion', function(done) {
//          cy.on('window:alert', (str) => {
//            expect(str).to.eq('Remove all pending invitations before deleting the team');
//            done();
//          });
//          cy.get('#delete-team').click();
//        });
//      });

      context('when organization has no member teams', () => {
        beforeEach(() => {
          cy.contains('The National Lacrosse League').click();
          cy.wait(300);
        });

        it('displays a popup warning', function(done) {
          cy.on('window:confirm', (str) => {
            expect(str).to.eq('Are you sure you want to delete this organization?');
            done();
          });
          cy.get('#delete-org').click();
        });

        it('lands in the proper place', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('#delete-org').click();
          cy.url().should('contain', `/#/agent`);
        });

        it('removes record from the organizer\'s user_metadata', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
            expect(results.length).to.eq(1);
            expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
            cy.get('#delete-org').click();
            cy.wait(300);
            cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
              expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(0);
            });
          });
        });

        it('renders the interface correctly on completion with success message', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('#delete-org').click();
          cy.wait(300);
          cy.get('#organizations-table table tbody tr td').contains('No records to display');
          cy.get('#flash-message').contains('Organization deleted');
        });

        it('doesn\'t mess up organization order', () => {
          cy.visit('/#/agent');
          cy.wait(300);

          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.get('#organizations-table input[placeholder="Name"]').type('The National Hockey League');
          cy.get('#organizations-table button[title="Save"]').click();
          cy.wait(300);

          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.get('#organizations-table input[placeholder="Name"]').type('The National Basketball Association');
          cy.get('#organizations-table button[title="Save"]').click();
          cy.wait(300);

          cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 3);

          cy.contains('The National Hockey League').click();
          cy.wait(300);

          cy.get('#delete-org').click();
          cy.wait(300);

          cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);
          cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('The National Lacrosse League');
          cy.get('#organizations-table table tbody:nth-child(2)').find('tr:last-child').contains('The National Basketball Association');

          cy.contains('The National Lacrosse League').click();
          cy.wait(300);
          cy.get('#delete-org').click();
          cy.wait(300);

          cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);
          cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('The National Basketball Association');

          cy.contains('The National Basketball Association').click();
          cy.wait(300);
          cy.get('#delete-org').click();
          cy.wait(300);

          cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);
          cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('No records to display');
        });
      });

//      describe('on team edit page', () => {
//        context('when team has team members', () => {
//          beforeEach(function() {
//            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((res) => {
//              cy.visit('/#/').then(() => {
//                cy.get('#app-menu-button').click();
//                cy.get('#organization-button').click();
//                cy.contains('One Book Canada').click();
//                cy.contains(team.name).click();
//                cy.get('button#edit-team').click();
//              });
//            });
//          });
//
//          it('does not allow deletion', function(done) {
//            cy.on('window:alert', (str) => {
//              expect(str).to.eq('Remove all team members before deleting the team');
//              done();
//            });
//            cy.get('button#delete-team').click();
//          });
//        });
//
//        context('when team has no team members', () => {
//          beforeEach(() => {
//            cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//              expect(results.length).to.eq(1);
//              expect(results[0].AgentId).to.eq(agent.id);
//              cy.visit('/#/').then(() => {
//                cy.get('#app-menu-button').click();
//                cy.get('#organization-button').click();
//                cy.contains('One Book Canada').click();
//                cy.contains(team.name).click();
//                cy.get('button#edit-team').click();
//              });
//            });
//          });
//
//          it('displays a popup warning', function(done) {
//            cy.on('window:confirm', (str) => {
//              expect(str).to.eq('Delete team?');
//              done();
//            });
//            cy.get('button#delete-team').click();
//          });
//
//          it('lands in the proper place', () => {
//            cy.on('window:confirm', (str) => {
//              return true;
//            });
//            cy.get('button#delete-team').click();
//            cy.url().should('contain', `/#/organization/${organization.id}`);
//          });
//
//          it('removes record from the database', () => {
//            cy.on('window:confirm', (str) => {
//              return true;
//            });
//            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
//              expect(results.length).to.eq(1);
//              cy.get('button#delete-team').click();
//              cy.wait(500);
//              cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
//                expect(results.length).to.eq(0);
//              });
//            });
//          });
//
//          it('renders the interface correctly on completion with success message', () => {
//            cy.on('window:confirm', (str) => {
//              return true;
//            });
//            cy.get('button#delete-team').click();
//            cy.wait(500);
//            cy.get('#organization-team-list').should('not.exist');
//            cy.contains('Team deleted');
//          });
//        });
//      });
    });
  });
});

export {}

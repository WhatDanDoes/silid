context('root/Team delete agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Invitations" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};
  });

  describe('Deleting agent from team', () => {

    let root, regularAgent;

    describe('root\'s own team', () => {
      beforeEach(() => {
        cy.login(_profile.email, _profile);
        // Logged in as root
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(200);

        // Invite agent to join as member
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(200);
        cy.get('#members-table button span span').contains('add_box').click();
        cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').type('someguy@example.com{enter}');

        // Login as team member and accept the invitation
        cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });
        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
        cy.wait(300);

        // Refresh agent model to get `socialProfile`
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          regularAgent = results[0];

          // Log back in as root
          cy.login(_profile.email, _profile);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='root@example.com' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });

            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);

            // root
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);
    
            // Member agent
            cy.get('tr:nth-of-type(2) button[title=Delete]').should('exist');
            cy.get('tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);

            // Delete memebr
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').click();
            cy.wait(300);
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);
    
            // Only the root agent
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.wait(200);
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });

            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);

            // root
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);
    
            // Member agent
            cy.get('tr:nth-of-type(2) button[title=Delete]').should('exist');
            cy.get('tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);

            // Delete memebr
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').click();
            cy.wait(300);
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);
    
            // Only the root agent
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);
          });
        });
      });
    });


    describe('a team of which root is a member', () => {
      beforeEach(() => {
        cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });
        // Logged in as regular agent
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(200);

        // Invite root to join as member
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(200);
        cy.get('#members-table button span span').contains('add_box').click();
        cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').type('root@example.com{enter}');

        // Login as root and accept the invitation
        cy.login('root@example.com', _profile);
        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
        cy.wait(300);

        // Refresh agent model to get `socialProfile`
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          regularAgent = results[0];

//          // Log back in as root
//          cy.login(_profile.email, _profile);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='root@example.com' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });
      });
      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });

            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);

            // root
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.email);
    
            // Team leader
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);

            // Delete root (because leader can't be deleted)
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);
    
            // Only the team leader 
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(regularAgent.socialProfile.user_metadata.teams[0].leader);
          });

          it('displays the correct success message', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);
            cy.contains(`Member removed`);
          });

          it('is removed from root\'s main profile page', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });

            // Delete root (because leader can't be deleted)
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);
            cy.contains('Identity').click(); 
            cy.wait(300);

            // No team 
            cy.get('#teams-table').contains('No records to display').should('exist');
          });

        });

//        context('switched off', () => {
//          beforeEach(() => {
//            cy.get('#app-menu-button').click();
//            cy.wait(200);
//            cy.get('#admin-switch').uncheck();
//            cy.wait(200);
//            cy.get('#app-menu').contains('Profile').click();
//            cy.wait(200);
//            cy.contains('The Calgary Roughnecks').click();
//            cy.wait(200);
//          });
//
//          it('updates the record on the interface', () => {
//            cy.on('window:confirm', (str) => {
//              return true;
//            });
//
//            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);
//
//            // root
//            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
//            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
//            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);
//    
//            // Member agent
//            cy.get('tr:nth-of-type(2) button[title=Delete]').should('exist');
//            cy.get('tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
//            cy.get('tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);
//
//            // Delete memebr
//            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').click();
//            cy.wait(300);
//            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);
//    
//            // Only the root agent
//            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
//            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
//            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);
//          });
//        });
      });
    });




//    let root, regularAgent, organization, team;
//    beforeEach(function() {
//      // Login/create regular agent
//      cy.login('regularguy@example.com', _profile, [this.scope.read.agents, this.scope.create.organizations]);
//      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
//        regularAgent = results[0];
//        cy.request({ url: '/organization',  method: 'POST', body: { name: 'National Lacrosse League' } }).then((org) => {
//          organization = org.body;
//
//          cy.login(_profile.email, _profile);
//          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
//            root = results[0];
//          });
//        });
//      });
//    });
//
//    describe('root\'s own team', () => {
//
//      describe('when an organization member', () => {
//        beforeEach(function() {
//          cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.update.organizations]);
//
//          // Add root as member
//          cy.request({ url: '/organization', method: 'PATCH', body: { id: organization.id, memberId: root.id } }).then((res) => {
//
//            // Verify root membership
//            cy.task('query', `UPDATE "OrganizationMembers" SET "verificationCode"=null WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {
//
//              // Login root and create team
//              cy.login(root.email, _profile);
//              cy.request({ url: '/team',  method: 'POST',
//                           body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
//                team = res.body;
//
//                // Add agent to team
//                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: 'somenewguy@example.com' } });
//                cy.wait(500);
//              });
//            });
//          });
//        });
//
//        describe('admin mode', () => {
//          context('switched on', () => {
//            beforeEach(function() {
//              cy.get('#app-menu-button').click();
//              cy.get('#admin-switch').check();
//              cy.contains('Team Directory').click();
//              cy.wait(500);
//              cy.contains(team.name).click();
//              cy.wait(500);
//            });
//
//            it('updates the interface', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
//              cy.get('.delete-member').first().click();
//              cy.wait(500);
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
//            });
//
//            it('updates the database', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                expect(results.length).to.eq(2);
//                cy.get('.delete-member').first().click();
//                cy.wait(500);
//                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                  expect(results.length).to.eq(1);
//                });
//              });
//            });
//          });
//
//          context('switched off', () => {
//            beforeEach(function() {
//              cy.get('#app-menu-button').click();
//              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
//              cy.get('#organization-button').click();
//              cy.wait(500);
//              cy.contains(organization.name).click();
//              cy.wait(500);
//              cy.contains(team.name).click();
//              cy.wait(500);
//            });
//
//            it('updates the interface', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
//              cy.get('.delete-member').first().click();
//              cy.wait(500);
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
//            });
//
//            it('updates the database', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                expect(results.length).to.eq(2);
//                cy.get('.delete-member').first().click();
//                cy.wait(500);
//                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                  expect(results.length).to.eq(1);
//                });
//              });
//            });
//          });
//        });
//      });
//
//      describe('when not an organization member', () => {
//        beforeEach(function() {
//          // Login root and create team
//          cy.login(root.email, _profile);
//          cy.request({ url: '/team',  method: 'POST',
//                       body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
//            team = res.body;
//            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: 'somenewguy@example.com' } });
//            cy.wait(500);
//          });
//        });
//
//        describe('admin mode', () => {
//          context('switched on', () => {
//            beforeEach(function() {
//              cy.get('#app-menu-button').click();
//              cy.get('#admin-switch').check();
//              cy.contains('Team Directory').click();
//              cy.wait(500);
//              cy.contains(team.name).click();
//              cy.wait(500);
//            });
//
//            it('updates the interface', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
//              cy.get('.delete-member').first().click();
//              cy.wait(500);
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
//            });
//
//            it('updates the database', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                expect(results.length).to.eq(2);
//                cy.get('.delete-member').first().click();
//                cy.wait(500);
//                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                  expect(results.length).to.eq(1);
//                });
//              });
//            });
//          });
//
//          context('switched off', () => {
//            beforeEach(function() {
//              cy.get('#app-menu-button').click();
//              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
//              cy.get('#organization-button').click();
//              cy.wait(500);
//              cy.contains(organization.name).should('not.exist');
//              cy.visit(`/#/team/${team.id}`);
//              cy.wait(500);
//            });
//          });
//
//          // A root agent is still a root agent. The only thing contstraining
//          // the root agent from changing data is the interface itself.
//          it('does not display any delete buttons', () => {
//            cy.get('button#delete-member').should('not.exist');
//          });
//        });
//      });
//    });
//
//    describe('team created by a regular agent', () => {
//      describe('when root is an organization member', () => {
//        beforeEach(function() {
//          cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.update.organizations, this.scope.create.organizationMembers, this.scope.create.teams, this.scope.create.teamMembers]);
//
//          // Add root as member
//          cy.request({ url: '/organization', method: 'PATCH', body: { id: organization.id, memberId: root.id } }).then((res) => {
//
//            // Verify root membership
//            cy.task('query', `UPDATE "OrganizationMembers" SET "verificationCode"=null WHERE "AgentId"=${root.id};`).then(([results, metadata]) => {
//
//              // Create team
//              cy.request({ url: '/team',  method: 'POST',
//                           body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
//                team = res.body;
//
//                // Add agent to team
//                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: 'somenewguy@example.com' } }).then(res => {
//
//                  // Login root
//                  cy.login(root.email, _profile);
//                });
//              });
//            });
//          });
//        });
//
//        describe('admin mode', () => {
//          context('switched on', () => {
//            beforeEach(() => {
//              cy.get('#app-menu-button').click();
//              cy.get('#admin-switch').check();
//              cy.contains('Team Directory').click();
//              cy.wait(500);
//              cy.contains(team.name).click();
//              cy.wait(500);
//            });
//
//            it('updates the interface', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
//              cy.get('.delete-member').first().click();
//              cy.wait(500);
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
//            });
//
//            it('updates the database', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                expect(results.length).to.eq(2);
//                cy.get('.delete-member').first().click();
//                cy.wait(500);
//                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                  expect(results.length).to.eq(1);
//                });
//              });
//            });
//          });
//
//          context('switched off', () => {
//            beforeEach(function() {
//              cy.get('#app-menu-button').click();
//              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
//              cy.get('#organization-button').click();
//              cy.wait(500);
//              cy.contains(organization.name).click();
//              cy.wait(500);
//              cy.contains(team.name).click();
//              cy.wait(500);
//            });
//
//            // A root agent is still a root agent. The only thing contstraining
//            // the root agent from changing data is the interface itself.
//            it('does not display any delete buttons', () => {
//              cy.get('.delete-member').should('not.exist');
//            });
//          });
//        });
//      });
//
//      describe('when root is not an organization member', () => {
//        beforeEach(function() {
//          cy.login(regularAgent.email, _profile, [this.scope.read.agents, this.scope.create.organizations, this.scope.create.teams, this.scope.create.teamMembers]);
//
//          // Create team
//          cy.request({ url: '/team',  method: 'POST',
//                       body: { organizationId: organization.id, name: 'The Calgary Roughnecks' } }).then(res => {
//            team = res.body;
//
//            // Add agent to team
//            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: 'somenewguy@example.com' } }).then(res => {
//
//              // Login root
//              cy.login(root.email, _profile);
//            });
//          });
//        });
//
//        describe('admin mode', () => {
//          context('switched on', () => {
//            beforeEach(() => {
//              cy.get('#app-menu-button').click();
//              cy.get('#admin-switch').check();
//              cy.contains('Team Directory').click();
//              cy.wait(500);
//              cy.contains(team.name).click();
//              cy.wait(500);
//            });
//
//            it('updates the interface', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
//              cy.get('.delete-member').first().click();
//              cy.wait(500);
//              cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
//            });
//
//            it('updates the database', () => {
//              cy.on('window:confirm', (str) => {
//                return true;
//              });
//              cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                expect(results.length).to.eq(2);
//                cy.get('.delete-member').first().click();
//                cy.wait(500);
//                cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
//                  expect(results.length).to.eq(1);
//                });
//              });
//            });
//          });
//
//          context('switched off', () => {
//            beforeEach(function() {
//              cy.get('#app-menu-button').click();
//              cy.get('#app-menu ul div:nth-of-type(4) input').should('have.attr', 'type', 'checkbox').and('not.be.checked');
//              cy.get('#organization-button').click();
//              cy.wait(500);
//              cy.contains(organization.name).should('not.exist');
//              cy.visit(`/#/team/${team.id}`);
//              cy.wait(500);
//            });
//
//            // A root agent is still a root agent. The only thing contstraining
//            // the root agent from changing data is the interface itself.
//            it('does not display any delete buttons', () => {
//              cy.get('.delete-member').should('not.exist');
//            });
//          });
//        });
//      });
//    });
  });
});

export {}

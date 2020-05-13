context('viewer/Team add agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  context('authenticated', () => {

    let agent, anotherAgent;
    beforeEach(function() {
      // Login/create another agent
      cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'}, [this.scope.read.agents]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        anotherAgent = results[0];

        // Login/create main test agent
        cy.login(_profile.email, _profile, [this.scope.read.agents,
                                            this.scope.create.organizations,
                                            this.scope.read.organizations,
                                            this.scope.update.organizations,
                                            this.scope.create.teams,
                                            this.scope.read.teams,
                                            this.scope.create.teamMembers]);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Invitations" CASCADE;');
    });

    context('creator agent visit', () => {

      let organization, team;
      beforeEach(function() {

        cy.get('button span span').contains('add_box').click();
        cy.get('input[placeholder="Name"]').type('The A-Team');
        cy.get('button[title="Save"]').click();
        cy.wait(300);
        cy.contains('The A-Team').click();
        cy.wait(300);
      });

      describe('add-agent button', () => {
        it('reveals the input form', () => {
          cy.get('div div div div div div table tbody tr td div button[title="Save"]').should('not.exist');
          cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').should('not.exist');
          cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('not.exist');
          cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').should('not.exist');
          cy.get('button span span').contains('add_box').click();
          cy.get('div div div div div div table tbody tr td div button[title="Save"]').should('exist');
          cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').should('exist');
          cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('not.exist');
          cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').should('exist');
        });


        describe('add-member-agent-form', () => {
          beforeEach(function() {
            cy.get('button span span').contains('add_box').click();
          });

          describe('cancel-add-agent button', () => {
            it('hides the add-member-agent-form', function() {
              cy.get('button[title="Cancel"]').click();

              cy.get('div div div div div div table tbody tr td div button[title="Save"]').should('not.exist');
              cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').should('not.exist');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('not.exist');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').should('not.exist');
            });

            it('clears the email input field', function() {
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').type('newteammember@example.com');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').should('have.value', 'newteammember@example.com');

              cy.get('button[title="Cancel"]').click();
              cy.get('button span span').contains('add_box').click();

              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').should('be.empty');
            });
          });

          describe('add-member-agent-button', () => {
            it('does not allow a blank field', function() {
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').clear();
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').type('            ');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').should('have.value', '            ');
              cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
              cy.contains('Email can\'t be blank');
              // Try a second time
              cy.get('#flash-message #close-flash').click();
              cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
              cy.contains('Email can\'t be blank');
            });

            it('does not allow an empty field', function() {
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').type('newteammember@example.com');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').clear();
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').should('have.value', '');
              cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
              cy.contains('Email can\'t be blank');
              // Try a second time
              cy.get('#flash-message #close-flash').click();
              cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
              cy.contains('Email can\'t be blank');
            });

            it('does not allow an invalid email', function() {
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').type('this is not an email');
              cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
              cy.contains('That\'s not a valid email address');
              // Try a second time
              cy.get('#flash-message #close-flash').click();
              cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
              cy.contains('That\'s not a valid email address');
            });

            describe('unknown agent', () => {
              it('creates an invitation in the database', function() {
                cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(0);

                  cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);

                  cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(1);
                  });
                });
              });

              it('hides the add-member-agent-form', function() {
                cy.get('#members-table table tbody tr td div button[title="Save"]').should('exist');
                cy.get('#members-table table tbody tr td div button[title="Cancel"]').should('exist');
                cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('exist');

                cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#members-table table tbody tr td div button[title="Save"]').should('not.exist');
                cy.get('#members-table table tbody tr td div button[title="Cancel"]').should('not.exist');
                cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('not.exist');
              });

              it('reveals the pending-invitations-table', function() {
                cy.get('#pending-invitations-table').should('not.exist');

                cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#pending-invitations-table').should('exist');
                cy.get('#pending-invitations-table table thead tr th').contains('Actions');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('delete_outline');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('refresh');
                cy.get('#pending-invitations-table table thead tr th').contains('Email');
                cy.get('#pending-invitations-table table tbody tr td').contains('somenewguy@example.com');
              });

              it('persists pending invitations between refreshes', function() {
                cy.get('#pending-invitations-table').should('not.exist');

                cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#pending-invitations-table').should('exist');
                cy.get('#pending-invitations-table table thead tr th').contains('Actions');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('delete_outline');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('refresh');
                cy.get('#pending-invitations-table table thead tr th').contains('Email');
                cy.get('#pending-invitations-table table tbody tr td').contains('somenewguy@example.com');

                cy.reload();
                cy.wait(300);
                cy.contains('The A-Team').click();
                cy.wait(300);

                cy.get('#pending-invitations-table').should('exist');
                cy.get('#pending-invitations-table table thead tr th').contains('Actions');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('delete_outline');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('refresh');
                cy.get('#pending-invitations-table table thead tr th').contains('Email');
                cy.get('#pending-invitations-table table tbody tr td').contains('somenewguy@example.com');
              });

              it('allows inviting multiple agents', function() {
                cy.get('#pending-invitations-table').should('not.exist');

                cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);

                cy.get('button span span').contains('add_box').click();
                cy.get('input[placeholder="Email"]').type('anothernewguy@example.com');
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 2);

                cy.get('button span span').contains('add_box').click();
                cy.get('input[placeholder="Email"]').type('yetanothernewguy@example.com');
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 3);
              });

              describe('is re-sent an invitation', () => {
                beforeEach(() => {
                  cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);
                });

                describe('via the members table', () => {
                  it('doesn\'t add a new pending invitation to the table', () => {
                    cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);

                    cy.get('button span span').contains('add_box').click();
                    cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                    cy.get('button[title="Save"]').click();
                    cy.wait(300);

                    cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);
                  });

                  it('displays a message', () => {
                    cy.get('button span span').contains('add_box').click();
                    cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                    cy.get('button[title="Save"]').click();
                    cy.wait(300);

                    cy.contains('Invitation sent');
                    cy.get('#flash-message #close-flash').click();

                    cy.get('button span span').contains('add_box').click();
                    cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                    cy.get('button[title="Save"]').click();
                    cy.wait(300);

                    cy.contains('Invitation sent');
                  });
                });

                describe('via the send button on the Pending Invitations table', () => {
                  it('doesn\'t add a new pending invitation to the table', () => {
                    cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);

                    cy.get('#pending-invitations-table button span span').contains('refresh').click();
                    cy.wait(300);

                    cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);
                  });

                  it('displays a message', () => {
                    cy.get('#pending-invitations-table button span span').contains('refresh').click();
                    cy.wait(300);

                    cy.contains('Invitation sent');
                    cy.get('#flash-message #close-flash').click();

                    cy.get('#pending-invitations-table button span span').contains('refresh').click();
                    cy.wait(300);

                    cy.contains('Invitation sent');
                  });
                });
              });
            });

            describe('known agent', () => {
              it('does not create an invitation in the database', function() {
                cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(0);

                  cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);

                  cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(0);
                  });
                });
              });

              it('hides the add-member-agent-form', function() {
                cy.get('#members-table table tbody tr td div button[title="Save"]').should('exist');
                cy.get('#members-table table tbody tr td div button[title="Cancel"]').should('exist');
                cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('exist');

                cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#members-table table tbody tr td div button[title="Save"]').should('not.exist');
                cy.get('#members-table table tbody tr td div button[title="Cancel"]').should('not.exist');
                cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('not.exist');
              });

              it('reveals the pending-invitations-table', function() {
                cy.get('#pending-invitations-table').should('not.exist');

                cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#pending-invitations-table').should('exist');
                cy.get('#pending-invitations-table table thead tr th').contains('Actions');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('delete_outline');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('refresh');
                cy.get('#pending-invitations-table table thead tr th').contains('Email');
                cy.get('#pending-invitations-table table tbody tr td').contains(anotherAgent.email);
              });

              it('persists pending invitations between refreshes', function() {
                cy.get('#pending-invitations-table').should('not.exist');

                cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.get('#pending-invitations-table').should('exist');
                cy.get('#pending-invitations-table table thead tr th').contains('Actions');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('delete_outline');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('refresh');
                cy.get('#pending-invitations-table table thead tr th').contains('Email');
                cy.get('#pending-invitations-table table tbody tr td').contains(anotherAgent.email);

                cy.reload();
                cy.wait(300);
                cy.contains('The A-Team').click();
                cy.wait(300);

                cy.get('#pending-invitations-table').should('exist');
                cy.get('#pending-invitations-table table thead tr th').contains('Actions');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('delete_outline');
                cy.get('#pending-invitations-table table tbody tr td button span').contains('refresh');
                cy.get('#pending-invitations-table table thead tr th').contains('Email');
                cy.get('#pending-invitations-table table tbody tr td').contains(anotherAgent.email);
              });

              describe('is re-sent an invitation', () => {
                beforeEach(() => {
                  cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);
                });

                describe('via the members table', () => {
                  it('doesn\'t add a new pending invitation to the table', () => {
                    cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);

                    cy.get('button span span').contains('add_box').click();
                    cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                    cy.get('button[title="Save"]').click();
                    cy.wait(300);

                    cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);
                  });

                  it('displays a message', () => {
                    cy.get('button span span').contains('add_box').click();
                    cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                    cy.get('button[title="Save"]').click();
                    cy.wait(300);

                    cy.contains('Invitation sent');
                    cy.get('#flash-message #close-flash').click();

                    cy.get('button span span').contains('add_box').click();
                    cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                    cy.get('button[title="Save"]').click();
                    cy.wait(300);

                    cy.contains('Invitation sent');
                  });
                });

                describe('via the send button on the Pending Invitations table', () => {
                  it('doesn\'t add a new pending invitation to the table', () => {
                    cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);

                    cy.get('#pending-invitations-table button span span').contains('refresh').click();
                    cy.wait(300);

                    cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);
                  });

                  it('displays a message', () => {
                    cy.get('#pending-invitations-table button span span').contains('refresh').click();
                    cy.wait(300);

                    cy.contains('Invitation sent');
                    cy.get('#flash-message #close-flash').click();

                    cy.get('#pending-invitations-table button span span').contains('refresh').click();
                    cy.wait(300);

                    cy.contains('Invitation sent');
                  });
                });
              });
            });

//            describe('erroneous additions', () => {
//
//              it('shows an error message when a duplicate agent is added', () => {
//                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 1);
//                cy.get('#team-member-list .list-item').first().contains(agent.email);
//
//                cy.get('input[name="email"][type="email"]').type(anotherAgent.email);
//                cy.get('button[type="submit"]').click();
//                cy.wait(500);
//                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
//                cy.get('#team-member-list .list-item').last().contains(anotherAgent.email);
//
//                // Add same agent
//                cy.get('button#add-agent').click();
//                cy.get('input[name="email"][type="email"]').type(anotherAgent.email);
//                cy.get('button[type="submit"]').click();
//                cy.wait(500);
//                cy.get('#team-member-list').find('.list-item').its('length').should('eq', 2);
//                cy.contains(`${anotherAgent.email} is already a member of this team`);
//              });
//            });
          });
        });
      });
    });

//    context('verified member agent visit', () => {
//
//      let organization, team;
//      beforeEach(function() {
//        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
//          organization = org.body;
//          cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: anotherAgent.id } }).then((res) => {
//
//            // Verify agent membership
//            cy.task('query', `UPDATE "OrganizationMembers" SET "verificationCode"=null WHERE "AgentId"=${anotherAgent.id};`).then(([results, metadata]) => {
//
//              cy.request({ url: '/team',  method: 'POST',
//                           body: { organizationId: organization.id, name: 'Calgary Roughnecks' } }).then(res => {
//                team = res.body;
//
//                cy.login(anotherAgent.email, _profile, [this.scope.read.agents, this.scope.read.organizations]);
//                cy.visit('/#/');
//                cy.get('#app-menu-button').click();
//                cy.get('#organization-button').click();
//                cy.contains('One Book Canada').click();
//                cy.contains('Calgary Roughnecks').click();
//              });
//            });
//          });
//        });
//      });
//
//      it('lands in the right spot', () => {
//        cy.url().should('contain', `/#/team/${team.id}`);
//      });
//
//      it('displays common Team interface elements', function() {
//        cy.get('button#add-agent').should('not.exist');
//        cy.get('button#add-team').should('not.exist');
//      });
//    });

//    context('unverified member agent visit', () => {
//
//      let organization, team;
//      beforeEach(function() {
//        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
//          organization = org.body;
//          cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: anotherAgent.id } }).then((res) => {
//            cy.request({ url: '/team',  method: 'POST',
//                         body: { organizationId: organization.id, name: 'Calgary Roughnecks' } }).then(res => {
//              team = res.body;
//
//              cy.login(anotherAgent.email, _profile, [this.scope.read.agents, this.scope.read.organizations]);
//              cy.visit('/#/');
//              cy.get('#app-menu-button').click();
//              cy.get('#organization-button').click();
//              cy.contains('One Book Canada').click();
//            });
//          });
//        });
//      });
//
//      it('lands in the right spot', () => {
//        cy.url().should('contain', `/#/organization/${organization.id}`);
//      });
//
//      it('displays common Team interface elements', function() {
//        cy.get('button#add-agent').should('not.exist');
//        cy.get('button#add-team').should('not.exist');
//        cy.contains('You have not verified your invitation to this organization. Check your email.');
//      });
//    });
  });
});

export {}

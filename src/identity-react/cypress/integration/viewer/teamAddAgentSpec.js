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
                                            this.scope.create.teamMembers,
                                            this.scope.delete.teamMembers]);
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

      let team;
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
          cy.get('#members-table table tbody tr td div button[title="Save"]').should('not.exist');
          cy.get('#members-table table tbody tr td div button[title="Cancel"]').should('not.exist');
          cy.get('#members-table table tbody tr td div div input[placeholder="Name"]').should('not.exist');
          cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('not.exist');
          cy.get('button span span').contains('add_box').click();
          cy.get('#members-table table tbody tr td div button[title="Save"]').should('exist');
          cy.get('#members-table table tbody tr td div button[title="Cancel"]').should('exist');
          cy.get('#members-table table tbody tr td div div input[placeholder="Name"]').should('not.exist');
          cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('exist');
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
              cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').clear();
              cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').type('            ');
              cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('have.value', '            ');
              cy.get('#members-table table tbody tr:nth-child(2) td div button').contains('check').click();
              cy.contains('Email can\'t be blank');
              // Try a second time
              cy.get('#flash-message #close-flash').click();
              cy.get('#members-table table tbody tr:nth-child(2) td div button').contains('check').click();
              cy.contains('Email can\'t be blank');
            });

            it('does not allow an empty field', function() {
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').type('newteammember@example.com');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').clear();
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').should('have.value', '');
              cy.get('#members-table table tbody tr:nth-child(2) td div button').contains('check').click();
              cy.contains('Email can\'t be blank');
              // Try a second time
              cy.get('#flash-message #close-flash').click();
              cy.get('#members-table table tbody tr:nth-child(2) td div button').contains('check').click();
              cy.contains('Email can\'t be blank');
            });

            it('does not allow an invalid email', function() {
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Email"]').type('this is not an email');
              cy.get('#members-table table tbody tr:nth-child(2) td div button').contains('check').click();
              cy.contains('That\'s not a valid email address');
              // Try a second time
              cy.get('#flash-message #close-flash').click();
              cy.get('#members-table table tbody tr:nth-child(2) td div button').contains('check').click();
              cy.contains('That\'s not a valid email address');
            });

            it('gives focus to the email input field', () => {
              cy.focused().should('have.attr', 'placeholder').and('eq', 'Email');
            });

            it('displays progress spinner', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('#progress-spinner').should('not.exist');

              cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
              cy.get('button[title="Save"]').click();
              // 2020-5-26
              // Cypress goes too fast for this. Cypress also cannot intercept
              // native `fetch` calls to allow stubbing and delaying the route.
              // Shamefully, this is currently manually tested, though I suspect
              // I will use this opportunity to learn Jest
              // Despite its name, this test really ensures the spinner disappears
              // after all is said and done
              //cy.get('#progress-spinner').should('exist');
              cy.wait(100);
              cy.get('#progress-spinner').should('not.exist');
            });

            describe('execute invitation with Enter key', () => {
              it('creates an Invitation in the database', () => {
                cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(0);

                  cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').type('somenewguy@example.com{enter}');
                  cy.wait(300);

                  cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(1);
                  });
                });
              });

              it('clears input field', () => {
                cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').type('somenewguy@example.com{enter}');
                cy.wait(300);
                cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').should('have.value', '');
              });
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

              context('is logged in', () => {
                describe('the invitation', () => {

                  beforeEach(function() {
                    cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                    cy.get('button[title="Save"]').click();
                    cy.wait(300);
                  });

                  it('is removed from the database', function() {
                    cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(1);

                      cy.login('somenewguy@example.com', {..._profile, name: 'Some New Guy'},
                                [this.scope.read.agents,
                                 this.scope.create.organizations,
                                 this.scope.read.organizations,
                                 this.scope.update.organizations,
                                 this.scope.create.teams,
                                 this.scope.read.teams,
                                 this.scope.create.teamMembers,
                                 this.scope.delete.teamMembers]);

                      cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                        expect(results.length).to.eq(0);
                      });
                    });
                  });

                  describe('RSVP table', () => {
                    beforeEach(function() {
                      cy.login('somenewguy@example.com', {..._profile, name: 'Some New Guy'},
                                [this.scope.read.agents,
                                 this.scope.create.organizations,
                                 this.scope.read.organizations,
                                 this.scope.update.organizations,
                                 this.scope.create.teams,
                                 this.scope.read.teams,
                                 this.scope.create.teamMembers,
                                 this.scope.delete.teamMembers]);
                    });

                    it('displays the team invite', () => {
                      cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);

                      cy.get('#rsvps-table').should('exist');
                      cy.get('#rsvps-table table thead tr th').contains('Actions');
                      cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline');
                      cy.get('#rsvps-table table tbody tr td button span').contains('check');
                      cy.get('#rsvps-table table thead tr th').contains('Name');
                      cy.get('#rsvps-table table tbody tr td').contains('The A-Team');
                      cy.get('#rsvps-table table thead tr th').contains('Type');
                      cy.get('#rsvps-table table tbody tr td').contains('team');
                    });

                    describe('accept button', () => {
                      beforeEach(() => {
                        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                          agent = results[0];
                        });
                      });

                      it('removes the entry from the RSVP table', () => {
                        cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);
                        cy.get('#rsvps-table').should('not.exist');
                      });

                      it('adds the entry to the Teams table', () => {
                        cy.get('#teams-table table tbody').contains('No records to display');
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);

                        cy.get('#teams-table table tbody').contains('No records to display').should('not.exist');
                        cy.get('#teams-table table thead tr th').contains('Name');
                        cy.get('#teams-table table tbody tr td a').should('contain', agent.socialProfile.user_metadata.teams[0].name).
                          and('have.attr', 'href').and('equal', `#team/${agent.socialProfile.user_metadata.teams[0].id}`);
                        cy.get('table thead tr th').contains('Leader');
                        cy.get('table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].leader);
                      });

                      it('persists membership status between refreshes', () => {
                        cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);
                        cy.get('#rsvps-table').should('not.exist');
                        cy.get('#teams-table table tbody tr td a').contains('The A-Team');
                        cy.reload();
                        cy.wait(300);
                        cy.get('#rsvps-table').should('not.exist');
                        cy.get('#teams-table table tbody tr td a').contains('The A-Team');
                      });

                      it('allows the agent to view the team', () => {
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);
                        cy.get('#teams-table table tbody tr td a').contains('The A-Team').click();
                        cy.wait(300);

                        cy.get('#members-table table thead tr th').contains('Name');
                        cy.get('#members-table table thead tr th').contains('Email');
                        cy.get('#members-table table tbody tr td a').should('contain', agent.name).and('have.attr', 'href').and('equal', `#agent/${agent.socialProfile.user_id}`);
                        cy.get('#members-table table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].leader);
                        cy.get('#members-table table tbody tr td a').should('contain', 'Some New Guy').and('have.attr', 'href');
                        cy.get('#members-table table tbody tr td').contains('somenewguy@example.com');
                      });

                      it('displays a friendly message', () => {
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);
                        cy.contains('Welcome to the team');
                      });

                      context('team leader login', () => {
                        beforeEach(function() {
                          cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                          cy.wait(300);

                          // Login/create main test agent
                          cy.login(_profile.email, _profile, [this.scope.read.agents,
                                                              this.scope.create.organizations,
                                                              this.scope.read.organizations,
                                                              this.scope.update.organizations,
                                                              this.scope.create.teams,
                                                              this.scope.read.teams,
                                                              this.scope.create.teamMembers,
                                                              this.scope.delete.teamMembers]);

                          cy.get('#teams-table table tbody tr td a').contains('The A-Team').click();
                          cy.wait(300);
                        });

                        it('removes the entry from the Pending Invitations table', () => {
                          cy.get('#pending-invitations-table').should('not.exist');
                        });

                        it('adds the new agent to the team members table', () => {
                          cy.get('#members-table table thead tr th').contains('Name');
                          cy.get('#members-table table thead tr th').contains('Email');
                          cy.get('#members-table table tbody tr td a').should('contain', agent.name).and('have.attr', 'href').and('equal', `#agent/${agent.socialProfile.user_id}`);
                          cy.get('#members-table table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].leader);
                          cy.get('#members-table table tbody tr td a').should('contain', 'Some New Guy').and('have.attr', 'href');
                          cy.get('#members-table table tbody tr td').contains('somenewguy@example.com');
                        });
                      });
                    });

                    describe('reject button', () => {
                      it('removes the entry from the RSVP table', () => {
                        cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);

                        cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline').click();
                        // Are you sure?
                        cy.get('#rsvps-table button[title="Save"]').contains('check').click();
                        cy.wait(300);

                        cy.get('#rsvps-table').should('not.exist');
                      });

                      it('does not add the entry to the Teams table', () => {
                        cy.get('#teams-table table tbody').contains('No records to display');
                        cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline').click();
                        // Are you sure?
                        cy.get('#rsvps-table button[title="Save"]').contains('check').click();
                        cy.wait(300);
                        cy.get('#teams-table table tbody').contains('No records to display');
                      });

                      it('displays a friendly message', () => {
                        cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline').click();
                        // Are you sure?
                        cy.get('#rsvps-table button[title="Save"]').contains('check').click();
                        cy.wait(300);
                        cy.contains('Invitation ignored');
                      });

                      context('team leader login', () => {
                        beforeEach(function() {
                          cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline').click();
                          // Are you sure?
                          cy.get('#rsvps-table button[title="Save"]').contains('check').click();
                          cy.wait(300);

                          // Login/create main test agent
                          cy.login(_profile.email, _profile, [this.scope.read.agents,
                                                              this.scope.create.organizations,
                                                              this.scope.read.organizations,
                                                              this.scope.update.organizations,
                                                              this.scope.create.teams,
                                                              this.scope.read.teams,
                                                              this.scope.create.teamMembers,
                                                              this.scope.delete.teamMembers]);

                          cy.get('#teams-table table tbody tr td a').contains('The A-Team').click();
                          cy.wait(300);
                        });

                        it('removes the entry from the Pending Invitations table', () => {
                          cy.get('#pending-invitations-table').should('not.exist');
                        });

                        it('does not add the new agent to the team members table', () => {
                          cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);
                          cy.get('#members-table table tbody tr td a').should('not.contain', 'Some New Guy');
                          cy.get('#members-table table tbody tr td').should('not.contain', 'somenewguy@example.com');
                        });
                      });
                    });
                  });
                });
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

                  it('displays progress spinner', () => {
                    cy.on('window:confirm', (str) => {
                      return true;
                    });
                    cy.get('#progress-spinner').should('not.exist');

                    cy.get('#pending-invitations-table button span span').contains('refresh').click();
                    // 2020-5-26
                    // Cypress goes too fast for this. Cypress also cannot intercept
                    // native `fetch` calls to allow stubbing and delaying the route.
                    // Shamefully, this is currently manually tested, though I suspect
                    // I will use this opportunity to learn Jest
                    // Despite its name, this test really ensures the spinner disappears
                    // after all is said and done
                    //cy.get('#progress-spinner').should('exist');
                    cy.wait(100);
                    cy.get('#progress-spinner').should('not.exist');
                  });
                });
              });

              describe('has invitation rescinded', () => {
                beforeEach(() => {
                  cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);
                });

                it('removes the invitation from the database', () => {
                  cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(1);

                    cy.get('#pending-invitations-table button[title="Delete"]').click();
                    // Are you sure?
                    cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();

                    cy.wait(300);

                    cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);
                    });
                  });
                });

                it('displays a message', () => {
                  cy.get('#pending-invitations-table button[title="Delete"]').click();
                  cy.wait(300);
                  // Are you sure?
                  cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();

                  cy.contains('Invitation canceled');
                });

                it('updates the pending invitations table', () => {
                  // Add another agent...
                  cy.get('button span span').contains('add_box').click();
                  cy.get('input[placeholder="Email"]').type('anothernewguy@example.com');
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);

                  // And another...
                  cy.get('button span span').contains('add_box').click();
                  cy.get('input[placeholder="Email"]').type('yetanothernewguy@example.com');
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);

                  cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 3);

                  // Remove second invitation
                  cy.get('#pending-invitations-table tr:nth-of-type(2) button[title="Delete"]').click();
                  cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();
                  cy.wait(300);

                  cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 2);
                  cy.get('#pending-invitations-table table tbody tr:nth-of-type(1) td').contains('somenewguy@example.com');
                  cy.get('#pending-invitations-table table tbody tr:nth-of-type(2) td').contains('yetanothernewguy@example.com');

                  // Remove first invitation
                  cy.get('#pending-invitations-table tr:nth-of-type(1) button[title="Delete"]').click();
                  cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();
                  cy.wait(300);

                  cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);
                  cy.get('#pending-invitations-table table tbody tr td').contains('yetanothernewguy@example.com');

                  // Remove last invitation
                  cy.get('#pending-invitations-table button[title="Delete"]').click();
                  cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();
                  cy.wait(300);

                  cy.get('#pending-invitations-table').should('not.exist');
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

              describe('has invitation rescinded', () => {
                beforeEach(() => {
                  cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);
                });

                it('does not impact the database', () => {
                  cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(0);

                    cy.get('#pending-invitations-table button[title="Delete"]').click();
                    // Are you sure?
                    cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();

                    cy.wait(300);

                    cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);
                    });
                  });
                });

                it('displays a message', () => {
                  cy.get('#pending-invitations-table button[title="Delete"]').click();
                  cy.wait(300);
                  // Are you sure?
                  cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();

                  cy.contains('Invitation canceled');
                });

                it('updates the pending invitations table', () => {
                  // Add another agent...
                  cy.get('button span span').contains('add_box').click();
                  cy.get('input[placeholder="Email"]').type('anothernewguy@example.com');
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);

                  // And another...
                  cy.get('button span span').contains('add_box').click();
                  cy.get('input[placeholder="Email"]').type('yetanothernewguy@example.com');
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);

                  cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 3);

                  // Remove second invitation
                  cy.get('#pending-invitations-table tr:nth-of-type(2) button[title="Delete"]').click();
                  cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();
                  cy.wait(300);

                  cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 2);
                  cy.get('#pending-invitations-table table tbody tr:nth-of-type(1) td').contains(anotherAgent.email);
                  cy.get('#pending-invitations-table table tbody tr:nth-of-type(2) td').contains('yetanothernewguy@example.com');

                  // Remove first invitation
                  cy.get('#pending-invitations-table tr:nth-of-type(1) button[title="Delete"]').click();
                  cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();
                  cy.wait(300);

                  cy.get('#pending-invitations-table table tbody').find('tr').its('length').should('eq', 1);
                  cy.get('#pending-invitations-table table tbody tr td').contains('yetanothernewguy@example.com');

                  // Remove last invitation
                  cy.get('#pending-invitations-table button[title="Delete"]').click();
                  cy.get('#pending-invitations-table button[title="Save"]').contains('check').click();
                  cy.wait(300);

                  cy.get('#pending-invitations-table').should('not.exist');
                });
              });

              context('is logged in', () => {
                describe('the invitation', () => {

                  beforeEach(function() {
                    cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                    cy.get('button[title="Save"]').click();
                    cy.wait(300);
                  });

                  it('has no impact on the database', function() {
                    cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(0);

                      cy.login(anotherAgent.email, {..._profile, name: anotherAgent.name},
                                [this.scope.read.agents,
                                 this.scope.create.organizations,
                                 this.scope.read.organizations,
                                 this.scope.update.organizations,
                                 this.scope.create.teams,
                                 this.scope.read.teams,
                                 this.scope.create.teamMembers,
                                 this.scope.delete.teamMembers]);

                      cy.task('query', `SELECT * FROM "Invitations";`).then(([results, metadata]) => {
                        expect(results.length).to.eq(0);
                      });
                    });
                  });

                  describe('RSVP table', () => {
                    beforeEach(function() {
                      cy.login(anotherAgent.email, {..._profile, name: anotherAgent.name},
                                [this.scope.read.agents,
                                 this.scope.create.organizations,
                                 this.scope.read.organizations,
                                 this.scope.update.organizations,
                                 this.scope.create.teams,
                                 this.scope.read.teams,
                                 this.scope.create.teamMembers,
                                 this.scope.delete.teamMembers]);
                    });

                    it('displays the team invite', () => {
                      cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);

                      cy.get('#rsvps-table').should('exist');
                      cy.get('#rsvps-table table thead tr th').contains('Actions');
                      cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline');
                      cy.get('#rsvps-table table tbody tr td button span').contains('check');
                      cy.get('#rsvps-table table thead tr th').contains('Name');
                      cy.get('#rsvps-table table tbody tr td').contains('The A-Team');
                      cy.get('#rsvps-table table thead tr th').contains('Type');
                      cy.get('#rsvps-table table tbody tr td').contains('team');
                    });

                    describe('accept button', () => {
                      beforeEach(() => {
                        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                          agent = results[0];
                        });
                      });

                      it('removes the entry from the RSVP table', () => {
                        cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);
                        cy.get('#rsvps-table').should('not.exist');
                      });

                      it('adds the entry to the Teams table', () => {
                        cy.get('#teams-table table tbody').contains('No records to display');
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);

                        cy.get('#teams-table table tbody').contains('No records to display').should('not.exist');
                        cy.get('#teams-table table thead tr th').contains('Name');
                        cy.get('#teams-table table tbody tr td a').should('contain', agent.socialProfile.user_metadata.teams[0].name).
                          and('have.attr', 'href').and('equal', `#team/${agent.socialProfile.user_metadata.teams[0].id}`);
                        cy.get('table thead tr th').contains('Leader');
                        cy.get('table tbody tr td').contains(agent.socialProfile.user_metadata.teams[0].leader);
                      });

                      it('persists membership status between refreshes', () => {
                        cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);
                        cy.get('#rsvps-table').should('not.exist');
                        cy.get('#teams-table table tbody tr td a').contains('The A-Team');
                        cy.reload();
                        cy.wait(300);
                        cy.get('#rsvps-table').should('not.exist');
                        cy.get('#teams-table table tbody tr td a').contains('The A-Team');
                      });

                      it('allows the agent to view the team', () => {
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);
                        cy.get('#teams-table table tbody tr td a').contains('The A-Team').click();
                        cy.wait(300);

                        cy.get('#members-table table thead tr th').contains('Name');
                        cy.get('#members-table table thead tr th').contains('Email');
                        cy.get('#members-table table tbody tr:nth-of-type(1) td a').should('contain', anotherAgent.name).and('have.attr', 'href').and('equal', `#agent/${anotherAgent.socialProfile.user_id}`);
                        cy.get('#members-table table tbody tr:nth-of-type(1) td').contains(anotherAgent.email);
                        cy.get('#members-table table tbody tr:nth-of-type(2) td a').should('contain', agent.name).and('have.attr', 'href').and('equal', `#agent/${agent.socialProfile.user_id}`);
                        cy.get('#members-table table tbody tr:nth-of-type(2) td').contains(agent.socialProfile.user_metadata.teams[0].leader);
                     });

                      it('displays a friendly message', () => {
                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        cy.wait(300);
                        cy.contains('Welcome to the team');
                      });

                      it('displays progress spinner', () => {
                        cy.on('window:confirm', (str) => {
                          return true;
                        });
                        cy.get('#progress-spinner').should('not.exist');

                        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                        // 2020-5-26
                        // Cypress goes too fast for this. Cypress also cannot intercept
                        // native `fetch` calls to allow stubbing and delaying the route.
                        // Shamefully, this is currently manually tested, though I suspect
                        // I will use this opportunity to learn Jest
                        // Despite its name, this test really ensures the spinner disappears
                        // after all is said and done
                        //cy.get('#progress-spinner').should('exist');
                        cy.wait(100);
                        cy.get('#progress-spinner').should('not.exist');
                      });

                      context('team leader login', () => {
                        beforeEach(function() {
                          cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                          cy.wait(300);

                          // Login/create main test agent
                          cy.login(_profile.email, _profile, [this.scope.read.agents,
                                                              this.scope.create.organizations,
                                                              this.scope.read.organizations,
                                                              this.scope.update.organizations,
                                                              this.scope.create.teams,
                                                              this.scope.read.teams,
                                                              this.scope.create.teamMembers,
                                                              this.scope.delete.teamMembers]);

                          cy.get('#teams-table table tbody tr td a').contains('The A-Team').click();
                          cy.wait(300);
                        });

                        it('removes the entry from the Pending Invitations table', () => {
                          cy.get('#pending-invitations-table').should('not.exist');
                        });

                        it('adds the new agent to the team members table', () => {
                          cy.get('#members-table table thead tr th').contains('Name');
                          cy.get('#members-table table thead tr th').contains('Email');
                          cy.get('#members-table table tbody tr:nth-of-type(1) td a').should('contain', anotherAgent.name).and('have.attr', 'href').and('equal', `#agent/${anotherAgent.socialProfile.user_id}`);
                          cy.get('#members-table table tbody tr:nth-of-type(1) td').contains(anotherAgent.email);
                          cy.get('#members-table table tbody tr:nth-of-type(2) td a').should('contain', agent.name).and('have.attr', 'href').and('equal', `#agent/${agent.socialProfile.user_id}`);
                          cy.get('#members-table table tbody tr:nth-of-type(2) td').contains(agent.socialProfile.user_metadata.teams[0].leader);
                        });
                      });
                    });

                    describe('reject button', () => {
                      it('removes the entry from the RSVP table', () => {
                        cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);

                        cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline').click();
                        // Are you sure?
                        cy.get('#rsvps-table button[title="Save"]').contains('check').click();
                        cy.wait(300);

                        cy.get('#rsvps-table').should('not.exist');
                      });

                      it('does not add the entry to the Teams table', () => {
                        cy.get('#teams-table table tbody').contains('No records to display');
                        cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline').click();
                        // Are you sure?
                        cy.get('#rsvps-table button[title="Save"]').contains('check').click();
                        cy.wait(300);
                        cy.get('#teams-table table tbody').contains('No records to display');
                      });

                      it('displays a friendly message', () => {
                        cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline').click();
                        // Are you sure?
                        cy.get('#rsvps-table button[title="Save"]').contains('check').click();
                        cy.wait(300);
                        cy.contains('Invitation ignored');
                      });

                      context('team leader login', () => {
                        beforeEach(function() {
                          cy.get('#rsvps-table table tbody tr td button span').contains('delete_outline').click();
                          // Are you sure?
                          cy.get('#rsvps-table button[title="Save"]').contains('check').click();
                          cy.wait(300);

                          // Login/create main test agent
                          cy.login(_profile.email, _profile, [this.scope.read.agents,
                                                              this.scope.create.organizations,
                                                              this.scope.read.organizations,
                                                              this.scope.update.organizations,
                                                              this.scope.create.teams,
                                                              this.scope.read.teams,
                                                              this.scope.create.teamMembers,
                                                              this.scope.delete.teamMembers]);

                          cy.get('#teams-table table tbody tr td a').contains('The A-Team').click();
                          cy.wait(300);
                        });

                        it('removes the entry from the Pending Invitations table', () => {
                          cy.get('#pending-invitations-table').should('not.exist');
                        });

                        it('does not add the new agent to the team members table', () => {
                          cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);
                          cy.get('#members-table table tbody tr td a').should('not.contain', anotherAgent.name);
                          cy.get('#members-table table tbody tr td').should('not.contain', anotherAgent.email);
                        });
                      });
                    });
                  });
                });
              });
            });

            describe('erroneous additions', () => {
              beforeEach(function() {
                // Invite new team member
                cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                // Accept invitation
                cy.login(anotherAgent.email, {..._profile, name: anotherAgent.name},
                          [this.scope.read.agents,
                           this.scope.create.organizations,
                           this.scope.read.organizations,
                           this.scope.update.organizations,
                           this.scope.create.teams,
                           this.scope.read.teams,
                           this.scope.create.teamMembers,
                           this.scope.delete.teamMembers]);
                cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
                cy.wait(300);
              });

              it('shows an error message when a duplicate agent is added', function() {

                // Login team leader and send invite to same agent
                cy.login(_profile.email, _profile, [this.scope.read.agents,
                                                    this.scope.create.organizations,
                                                    this.scope.read.organizations,
                                                    this.scope.update.organizations,
                                                    this.scope.create.teams,
                                                    this.scope.read.teams,
                                                    this.scope.create.teamMembers,
                                                    this.scope.delete.teamMembers]);

                cy.contains('The A-Team').click();
                cy.wait(300);

                cy.get('button span span').contains('add_box').click();
                cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.contains(`${anotherAgent.email} is already a member of this team`);

                cy.get('#flash-message #close-flash').click();

                cy.get('button span span').contains('add_box').click();
                cy.get('input[placeholder="Email"]').type(anotherAgent.email);
                cy.get('button[title="Save"]').click();
                cy.wait(300);

                cy.contains(`${anotherAgent.email} is already a member of this team`);
              });
            });
          });
        });
      });
    });

  });
});

export {}

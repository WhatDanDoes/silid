import React, { useState, useEffect } from 'react';
import { Redirect } from 'react-router-dom';
//import TextField from '@material-ui/core/TextField';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';


import Grid from '@material-ui/core/Grid';

/**
 * For profile data display
 */
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import MaterialTable, { MTableEditField } from 'material-table';

import Link from '@material-ui/core/Link';


//import Card from '@material-ui/core/Card';
//import CardContent from '@material-ui/core/CardContent';
//import Fab from '@material-ui/core/Fab';
//import PersonAddIcon from '@material-ui/icons/PersonAdd';
//import GroupIcon from '@material-ui/icons/Group';
import Button from '@material-ui/core/Button';
//import List from '@material-ui/core/List';
//import ListItem from '@material-ui/core/ListItem';
//import ListItemIcon from '@material-ui/core/ListItemIcon';
//import ListItemText from '@material-ui/core/ListItemText';
//import DeleteForeverOutlinedIcon from '@material-ui/icons/DeleteForeverOutlined';
//import InboxIcon from '@material-ui/icons/MoveToInbox';
//import { Organization } from '../types/Organization';
import Flash from '../components/Flash';
//import TeamCreateForm from '../components/TeamCreateForm';
import { useAuthState } from '../auth/Auth';
import { useAdminState } from '../auth/Admin';

import useGetOrganizationInfoService from '../services/useGetOrganizationInfoService';
import usePutOrganizationService from '../services/usePutOrganizationService';
import usePutOrganizationMemberService from '../services/usePutOrganizationMemberService';
import useDeleteOrganizationService from '../services/useDeleteOrganizationService';
import useDeleteMemberAgentService from '../services/useDeleteMemberAgentService';
import useDeleteTeamService from '../services/useDeleteTeamService';

const useStyles = makeStyles((theme) =>
  createStyles({
    margin: {
      margin: theme.spacing(1),
    },
    textField: {
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      width: '100%',
    },
    [theme.breakpoints.down('sm')]: {
      card: {
        marginTop: '4%',
        maxWidth: 720,
      },
    },
    [theme.breakpoints.up('md')]: {
      card: {
        marginLeft: '25%',
        marginTop: '4%',
        maxWidth: 720,
      },
    },
  }),
);

const OrganizationInfo = (props) => {
  const classes = useStyles();

  const {agent, updateAgent} = useAuthState();
  const admin = useAdminState();

  const [prevInputState, setPrevInputState] = useState({});

//  const [teamFormVisible, setTeamFormVisible] = useState(false);
//  const [editFormVisible, setEditFormVisible] = useState(false);
  const [agentFormVisible, setAgentFormVisible] = useState(false);
  const [prevState, setPrevState] = useState({});
  //const [toOrganization, setToOrganization] = useState(false);
  const [toAgent, setToAgent] = useState(null);
  const [flashProps, setFlashProps] = useState({});
  const [isWaiting, setIsWaiting] = useState(false);

  const [orgInfo, setOrgInfo] = useState({});

  const service = useGetOrganizationInfoService(props.match.params.id);
  let { publishOrganization } = usePutOrganizationService();
  let { putOrganizationMember } = usePutOrganizationMemberService();
  let { deleteOrganization } = useDeleteOrganizationService();
  let { deleteMemberAgent } = useDeleteMemberAgentService(props.match.params.id);
  let { deleteTeam } = useDeleteTeamService();

  useEffect(() => {
    if (service.status === 'loaded') {
      setOrgInfo(service.payload);
    }
  }, [service]);

  /**
   * Update this organization
   */
//  const handleSubmit = (evt) => {
//    evt.preventDefault();
//
//    const formData = new FormData(evt.target);
//    let data = {};
//    for (const [key, value] of formData.entries()) {
//      data[key] = value;
//    }
//
//    publishOrganization(data).then(results => {
//      setEditFormVisible(false);
//      setOrgInfo({ results, ...orgInfo });
//    }).catch(err => {
//      console.log(err);
//    });
//  }


  /**
   * Update this organization
   */
  const handleUpdate = (evt) => {
    // Front-end validation (sufficient for now...)
    if (!orgInfo.name.trim()) {
      return setFlashProps({ message: 'Organization name can\'t be blank', variant: 'error' });
    }

    //publishOrganization({...orgInfo, members: undefined, tableData: undefined}).then(results => {
    publishOrganization({...orgInfo}).then(results => {
      if (results.statusCode) {
        setFlashProps({ message: results.message, variant: 'error' });
      }
      else if (results.errors) {
        setFlashProps({...results, variant: 'error' });
      }
      else {
        setPrevInputState({});
        setOrgInfo(results);
        setFlashProps({ message: 'Organization updated', variant: 'success' });
      }
    }).catch(err => {
      console.log(JSON.stringify(err));
    });
  }



  /**
   * Remove this organization
   */
  const handleDelete = (evt) => {
    if (orgInfo.teams.length) {
      return window.alert('Remove all member teams before deleting the organization');
    }
    if (window.confirm('Are you sure you want to delete this organization?')) {
      deleteOrganization(orgInfo.id).then(results => {
        setToAgent(results.organizerId);
      });
    }
  }

  /**
   * Add a new member to this organization
   */
  const handleMembershipChange = (evt) => {
    evt.preventDefault();
    const formData = new FormData(evt.target);

    let data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    putOrganizationMember(data).then((results) => {
      setAgentFormVisible(false);
      if (results.message) {
        setFlashProps({ message: results.message, variant: 'warning' });
      }
      else {
        orgInfo.members.push(results);
        setOrgInfo({ ...orgInfo });
      }
    }).catch(err => {
      console.log(err);
    });
  }

  /**
   * Remove member from organization
   */
  const handleMemberDelete = (memberId) => {
    if (window.confirm('Remove member?')) {
      deleteMemberAgent(memberId).then(results => {
        const index = orgInfo.members.findIndex(member => member.id === memberId);
        orgInfo.members.splice(index, 1);
        setOrgInfo({ ...orgInfo });
        setFlashProps({ message: 'Member removed', variant: 'success' });
      }).catch(err => {
        console.log(err);
      });
    }
  }

  /**
   * Remove team from organization
   */
  const handleTeamDelete = (team) => {
    if (team.members && team.members.length > 1) {
      return window.alert('Remove all team members before deleting the team');
    }

    if (window.confirm('Remove team?')) {
      deleteTeam(team.id).then(results => {
        const index = orgInfo.teams.findIndex(t => t.id === team.id);
        orgInfo.teams.splice(index, 1);
        setOrgInfo({ ...orgInfo });
        setFlashProps({ message: 'Team deleted', variant: 'success' });
      }).catch(err => {
        console.log(err);
      });
    }
  }


//  const customMessage = (evt) => {
//    evt.target.setCustomValidity(`${evt.target.name} required`);
//  }

//  const onChange = (evt) => {
//    if (!prevState[evt.target.name]) {
//      const s = { ...prevState};
//      s[evt.target.name] = orgInfo[evt.target.name];
//      setPrevState(s);
//    }
//    const f = { ...orgInfo };
//    f[evt.target.name] = evt.target.value.trimLeft();
//    setOrgInfo(f);
//  }

//  function ListItemLink(props) {
//    return <ListItem className='list-item' button component="a" {...props} />;
//  }

  /**
   * Redirect to `/organization` when this org is deleted
   */
//  if (toOrganization) {
//    return <Redirect to={{ pathname: '/organization', state: 'Organization deleted' }} />
//  }

  /**
   * Redirect to `/agent` when this team is deleted
   */
  if (toAgent) {
    if (orgInfo.organizer === agent.email) {
      return <Redirect to={{ pathname: `/agent`, state: 'Organization deleted' }} />
    }
    return <Redirect to={{ pathname: `/agent/${toAgent}`, state: 'Organization deleted' }} />
  }

  /**
   * Invite team to join the organization
   */
  const inviteToOrg = (newData) => {
    return new Promise((resolve, reject) => {
//      newData.email = newData.email.trim();
//
//      if (!newData.email.length) {
//        setFlashProps({ message: 'Email can\'t be blank', variant: 'error' });
//        reject();
//      }
//      // 2020-5-5 email regex from here: https://redux-form.com/6.5.0/examples/material-ui/
//      else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(newData.email)) {
//        setFlashProps({ message: 'That\'s not a valid email address', variant: 'error' });
//        reject();
//      }
//      else {
//        setIsWaiting(true);
//        sendTeamInvitation(teamInfo.id, newData).then((results) => {
//          if (results.message) {
//            setFlashProps({ message: results.message, variant: 'warning' });
//          }
//          else {
//            setFlashProps({ message: 'Invitation sent', variant: 'success' });
//            updateAgent(results);
//          }
          resolve();
//        }).catch(err => {
//          console.log(err);
//          setFlashProps({ errors: [err], variant: 'error' });
//          reject(err);
//        }).finally(() => {
//          setIsWaiting(false);
//        });
//      }
    });
  };



  return (
    <div className={classes.root}>
      <Grid container direction="column" justify="center" alignItems="center">
        <Grid item>
          <Typography variant="body2" color="textSecondary" component="p">
            {service.status === 'loading' && <span>Loading...</span>}
          </Typography>
        </Grid>
        {service.status === 'loaded' && service.payload ?
          <>
            <Grid item>
              <Typography className={classes.header} variant="h5" component="h3">
                Organization
              </Typography>
            </Grid>
            <Grid item className={classes.grid}>
              <TableContainer component={Paper}>
                <Table id="org-profile-info" className={classes.table} aria-label="Team profile info">
                  <TableBody>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Name:</TableCell>
                      <TableCell align="left">
                        <input id="org-name-field" value={orgInfo.name || ''} disabled={agent.email !== orgInfo.organizer && !admin.isEnabled}
                          onChange={e => {
                              if (!prevInputState.name) {
                                setPrevInputState({ name: orgInfo.name });
                              }
                              setOrgInfo({ ...orgInfo, name: e.target.value });
                            }
                          } />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Email:</TableCell>
                      <TableCell align="left">{orgInfo.organizer}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            {orgInfo.organizer === agent.email || admin.isEnabled ?
              <Grid item className={classes.grid}>
                <TableContainer>
                  <Table className={classes.table} aria-label="Team delete">
                    <TableBody>
                      <TableRow>
                        { Object.keys(prevInputState).length ?
                          <>
                            <TableCell align="right">
                              <Button id="cancel-org-changes" variant="contained" color="secondary"
                                      onClick={e => {
                                        setOrgInfo({ ...orgInfo, ...prevInputState });
                                        setPrevInputState({});
                                      }
                              }>
                                Cancel
                              </Button>
                            </TableCell>
                            <TableCell align="left">
                              <Button id="save-org" variant="contained" color="primary" onClick={handleUpdate}>
                                Save
                              </Button>
                            </TableCell>
                          </>
                        :
                          <TableCell align="left">
                            <Button id="delete-org" variant="contained" color="secondary" onClick={handleDelete}>
                              Delete
                            </Button>
                          </TableCell>
                        }
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            : ''}

            <Grid id="member-teams-table" item className={classes.grid}>
              <MaterialTable
                title='Teams'
                isLoading={isWaiting}
                columns={[
                  {
                    title: 'Name',
                    field: 'name',
                    editable: 'never',
                    render: (rowData) => {
                      return rowData ? <Link href={`#team/${rowData.id}`}>{rowData.name}</Link> : null;
                    }
                  },
                  {
                    title: 'Leader',
                    field: 'leader',
                    editComponent: (props) => {
                      return (
                        <MTableEditField
                          autoFocus={true}
                          type="text"
                          columnDef={props.columnDef}
                          placeholder="Email"
                          value={props.value ? props.value : ''}
                          onChange={value => props.onChange(value) }
                          onKeyDown={evt => {
                              if (evt.key === 'Enter') {
                                //inviteToOrg({ email: evt.target.value });
                                props.onChange('');
                                return;
                              }
                            }
                          }
                        />
                      );
                    }
                  }
                ]}
                data={orgInfo.teams ? orgInfo.teams : []}
                options={{ search: false, paging: false }}
                actions={
                  [
                    rowData => ({
                      icon: 'delete_outline',
                      isFreeAction: false,
                      tooltip: 'Delete',
                      hidden: orgInfo.organizer !== agent.email && !admin.isEnabled,
                      onClick:() => {
                        new Promise((resolve, reject) => {
                          if (window.confirm('Remove team?')) {
                            setIsWaiting(true);

                            const headers = new Headers();
                            headers.append('Content-Type', 'application/json; charset=utf-8');
                            fetch(`/organization/${orgInfo.id}/agent/${rowData.user_id}`,
                              {
                                method: 'DELETE',
                                headers,
                              }
                            )
                            .then(response => response.json())
                            .then(response => {
                              if (response.message) {
                                orgInfo.teams.splice(orgInfo.teams.findIndex(m => m.user_id === rowData.user_id), 1);
                                setFlashProps({ message: response.message, variant: 'success' });
                                resolve();
                              }
                              else {
                                setFlashProps({ message: 'Deletion cannot be confirmed', variant: 'warning' });
                                reject(response);
                              }
                            }).catch(error => {
                              reject(error);
                            }).finally(() => {
                              setIsWaiting(false);
                            });
                          }
                          else {
                            setIsWaiting(false);
                            reject();
                          }
                        })
                      }
                    })
                  ]}
                editable={ orgInfo.organizer === agent.email || admin.isEnabled ? { onRowAdd: inviteToOrg } : undefined }
              />
            </Grid>
            {agent.user_metadata &&
             agent.user_metadata.pendingInvitations &&
             agent.user_metadata.pendingInvitations.length &&
             agent.user_metadata.pendingInvitations.filter(i => i.uuid === orgInfo.id).length ?
              <>
                <br />
                <Grid id="pending-invitations-table" item className={classes.grid}>
                  <MaterialTable
                    title='Pending Invitations'
                    isLoading={isWaiting}
                    columns={[
                      { title: 'Email', field: 'recipient', editable: 'never' }
                    ]}
                    data={agent.user_metadata.pendingInvitations.filter(i => i.uuid === orgInfo.id).length ?
                          agent.user_metadata.pendingInvitations.filter(i => i.uuid === orgInfo.id) : []}
                    options={{ search: false, paging: false }}
                    localization={{ body: { editRow: { deleteText: 'Are you sure you want to revoke this invitation?' } } }}
                    editable={ orgInfo.organizer === agent.email ? {
                      onRowDelete: oldData =>
                        new Promise((resolve, reject) => {
//                          rescindOrganizationInvitation(orgInfo.id, { email: oldData.recipient }).then((results) => {
//                            if (results.error) {
//                              setFlashProps({ message: results.message, variant: 'error' });
//                              return reject(results);
//                            }
//                            setFlashProps({ message: 'Invitation canceled', variant: 'success' });
//                            updateAgent(results);
                            resolve();
//                          }).catch(err => {
//                            console.log(err);
//                            setFlashProps({ errors: [err], variant: 'error' });
//                            reject(err);
//                          });
                        })
                    } : undefined}
                    actions={[
                      {
                        icon: 'refresh',
                        tooltip: 'Re-send invitation',
                        onClick: (event, rowData) =>
                          new Promise((resolve, reject) => {
                            setIsWaiting(true);
//                            sendOrganizationInvitation(orgInfo.id, { email: rowData.recipient }).then((results) => {
//                              if (results.message) {
//                                setFlashProps({ message: results.message, variant: 'warning' });
//                              }
//                              else {
//                                setFlashProps({ message: 'Invitation sent', variant: 'success' });
//                                updateAgent(results);
//                              }
                              resolve();
//                            }).catch(err => {
//                              console.log(err);
//                              setFlashProps({ errors: [err], variant: 'error' });
//                              reject(err);
//                            }).finally(() => {
//                              setIsWaiting(false);
//                            });
                          })
                      }
                    ]}
                  />
                </Grid>
              </>
            : ''}
          </>

        : ''}
        {service.status === 'error' && (
          <Typography id="error-message" variant="h5" component="h3">
            {service.error}
          </Typography>
        )}
      </Grid>

      { flashProps.message ? <Flash message={flashProps.message} onClose={() => setFlashProps({})} variant={flashProps.variant} /> : '' }
      { flashProps.errors ? flashProps.errors.map(error => <Flash message={error.message}
                                                                  onClose={() => setFlashProps({})}
                                                                  variant={flashProps.variant}
                                                                  key={`error-${error.message}`} />) : '' }

    </div>
  );
};

//    <div className="organization">
//      <Card className={classes.card}>
//        <CardContent>
//          <Typography variant="h5" component="h3">
//            {service.status === 'loading' && <div>Loading...</div>}
//            {service.status === 'loaded' ?
//              <React.Fragment>
//                <React.Fragment>
//                  {orgInfo.name}
//                </React.Fragment>
//                {admin.isEnabled || (orgInfo.organizer && (agent.email === orgInfo.organizer)) ?
//                  <React.Fragment>
//                    {!editFormVisible ?
//                      <Button id="edit-organization" variant="contained" color="primary" onClick={() => setEditFormVisible(true)}>
//                        Edit
//                      </Button>
//                    :
//                      <React.Fragment>
//                        <form id="edit-organization-form" onSubmit={handleSubmit}>
//                          <input type="hidden" name="id" value={orgInfo.id} />
//                          <TextField
//                            id="name-input"
//                            label="Name"
//                            type="text"
//                            className={classes.textField}
//                            InputLabelProps={{
//                              shrink: true,
//                            }}
//                            margin="normal"
//                            name="name"
//                            required
//                            value={orgInfo.name}
//                            onChange={onChange}
//                            onInvalid={customMessage}
//                          />
//                          <Button id="cancel-changes"
//                            variant="contained" color="secondary"
//                            onClick={() => {
//                              setOrgInfo({ ...orgInfo, ...prevState });
//                              setEditFormVisible(false);
//                            }}>
//                              Cancel
//                          </Button>
//                          <Button id="save-organization-button"
//                                  type="submit" variant="contained" color="primary"
//                                  disabled={!Object.keys(prevState).length}>
//                            Save
//                          </Button>
//                        </form>
//                        <Button id="delete-organization" variant="contained" color="secondary" onClick={handleDelete}>
//                          Delete
//                        </Button>
//                      </React.Fragment>
//                    }
//                  </React.Fragment>
//                : '' }
//                {!editFormVisible && !agentFormVisible && !teamFormVisible ?
//                    <Typography variant="body2" color="textSecondary" component="p">
//                      <React.Fragment>
//                        {admin.isEnabled || (orgInfo.organizer && (agent.email === orgInfo.organizer)) ?
//                          <Fab id="add-agent" color="primary" aria-label="add-agent" className={classes.margin}>
//                            <PersonAddIcon onClick={() => setAgentFormVisible(true)} />
//                          </Fab>
//                        : '' }
//                        <Fab id="add-team" color="primary" aria-label="add-team" className={classes.margin}>
//                          <GroupIcon onClick={() => setTeamFormVisible(true)} />
//                        </Fab>
//                      </React.Fragment>
//                    </Typography>
//                : ''}
//                {agentFormVisible ?
//                  <form id="add-member-agent-form" onSubmit={handleMembershipChange}>
//                    <input type="hidden" name="id" value={orgInfo.id} />
//                    <TextField
//                      id="email-input"
//                      label="New Member Email"
//                      type="email"
//                      className={classes.textField}
//                      InputLabelProps={{
//                        shrink: true,
//                      }}
//                      margin="normal"
//                      name="email"
//                      required
//                      onChange={onChange}
//                      onInvalid={customMessage}
//                    />
//                    <Button id="cancel-add-agent"
//                      variant="contained" color="secondary"
//                      onClick={() => {
//                        setOrgInfo({ ...orgInfo, ...prevState });
//                        setAgentFormVisible(false);
//                      }}>
//                        Cancel
//                    </Button>
//                    <Button id="add-member-agent-button"
//                            type="submit" variant="contained" color="primary"
//                            disabled={!Object.keys(prevState).length}>
//                      Add
//                    </Button>
//                  </form>
//                : ''}
//                {teamFormVisible ?
//                  <React.Fragment>
//                    <TeamCreateForm orgId={orgInfo.id}
//                      done={(results) => {
//                        setTeamFormVisible(false);
//                        if (results.errors) {
//                          setFlashProps({errors: results.errors, variant: 'error' });
//                        }
//                        else {
//                          orgInfo.teams.push(results);
//                          setOrgInfo({ ...orgInfo } as Organization);
//                        }
//                      }}/>
//                    <Button id="cancel-changes"
//                      variant="contained" color="secondary"
//                      onClick={() => {
//                        setTeamFormVisible(false);
//                      }}>
//                        Cancel
//                    </Button>
//                 </React.Fragment>
//               : ''}
//              </React.Fragment>
//            : ''}
//          </Typography>
//          {service.status === 'loading' && <div>Loading...</div>}
//          {service.status === 'loaded' && orgInfo.members && orgInfo.members.length ?
//            <List id="organization-member-list">
//              <Typography variant="h5" component="h3">
//                <React.Fragment>
//                  Members
//                </React.Fragment>
//              </Typography>
//              { orgInfo.members.map(member => (
//                <ListItem button className='organization-button' key={`agent-${agent.id}`}>
//                  <ListItemIcon><InboxIcon /></ListItemIcon>
//                  <ListItemLink href={`#agent/${member.id}`}>
//                    <ListItemText primary={member.email} />
//                  </ListItemLink>
//                  { orgInfo.organizer !== member.email && (agent.email === orgInfo.organizer || admin.isEnabled) ?
//                  <DeleteForeverOutlinedIcon className="delete-member" onClick={() => handleMemberDelete(member.id)} />
//                  : ''}
//                </ListItem>
//              ))}
//            </List> : ''}
//          {service.status === 'loaded' && orgInfo.teams && orgInfo.teams.length ?
//            <List id="organization-team-list">
//              <Typography variant="h5" component="h3">
//                <React.Fragment>
//                  Teams
//                </React.Fragment>
//              </Typography>
//              { orgInfo.teams.map(team => (
//                <ListItem button className='team-button' key={`team-${team.id}`}>
//                  <ListItemIcon><InboxIcon /></ListItemIcon>
//                  <ListItemLink href={`#team/${team.id}`}>
//                    <ListItemText primary={team.name} />
//                  </ListItemLink>
//                  { (agent.email === orgInfo.organizer) ?
//                    <DeleteForeverOutlinedIcon className="delete-team" onClick={() => handleTeamDelete(team)} />
//                  : ''}
//                </ListItem>
//              ))}
//            </List> : ''}
//
//          {service.status === 'error' && (
//            <Typography id="error-message" variant="h5" component="h3">
//              {service.error}
//            </Typography>
//          )}
//        </CardContent>
//      </Card>
//      { props.location.state ? <Flash message={props.location.state} variant="success" /> : '' }
//      { flashProps.message ? <Flash message={flashProps.message} variant={flashProps.variant} /> : '' }
//      { flashProps.errors ? flashProps.errors.map(error => <Flash message={error.message} variant={flashProps.variant} />) : '' }
//    </div>

export default OrganizationInfo;






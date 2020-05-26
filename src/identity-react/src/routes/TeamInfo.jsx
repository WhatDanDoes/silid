import React, { useState, useEffect } from 'react';
import { Redirect } from 'react-router-dom';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';

import Grid from '@material-ui/core/Grid';

import Flash from '../components/Flash';

import { useAuthState } from '../auth/Auth';
//import { useAdminState } from '../auth/Admin';

import useGetTeamInfoService from '../services/useGetTeamInfoService';
import usePutTeamService from '../services/usePutTeamService';
import useDeleteTeamService from '../services/useDeleteTeamService';
import useSendTeamInvitationService from '../services/useSendTeamInvitationService';
import useRescindTeamInvitationService from '../services/useRescindTeamInvitationService';
//import useDeleteTeamMemberService from '../services/useDeleteTeamMemberService';

/**
 * For profile data display
 */
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import MaterialTable from 'material-table';

import Link from '@material-ui/core/Link';

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
    // 2020-5-21 https://material-ui.com/components/progress/#CircularIntegration.js
    fabProgress: {
      color: 'green',
      zIndex: 1,
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


const TeamInfo = (props) => {
  const classes = useStyles();

  const {agent, updateAgent} = useAuthState();
//  const admin = useAdminState();

  const [prevInputState, setPrevInputState] = useState({});
  const [toAgent, setToAgent] = useState(false);
  const [flashProps, setFlashProps] = useState({});
  const [isWaiting, setIsWaiting] = useState(false);

  const [teamInfo, setTeamInfo] = useState({});

  const service = useGetTeamInfoService(props.match.params.id);
  let { publishTeam } = usePutTeamService();
  let { deleteTeam } = useDeleteTeamService();
  let { sendTeamInvitation } = useSendTeamInvitationService();
  let { rescindTeamInvitation } = useRescindTeamInvitationService();
//  let { deleteTeamMember, service: deleteTeamMemberService } = useDeleteTeamMemberService(props.match.params.id);

  useEffect(() => {
    if (service.status === 'loaded') {
      setTeamInfo(service.payload);
    }
  }, [service]);

  /**
   * Update this team
   */
  const handleUpdate = (evt) => {
    // Front-end validation (sufficient for now...)
    if (!teamInfo.name.trim()) {
      return setFlashProps({ message: 'Team name can\'t be blank', variant: 'error' });
    }

    publishTeam({...teamInfo, members: undefined, tableData: undefined}).then(results => {
      if (results.statusCode) {
        setFlashProps({ message: results.message, variant: 'error' });
      }
      else if (results.errors) {
        setFlashProps({...results, variant: 'error' });
      }
      else {
        setPrevInputState({});
        setTeamInfo(results);
        setFlashProps({ message: 'Team updated', variant: 'success' });
      }
    }).catch(err => {
      console.log(JSON.stringify(err));
    });
  }

  /**
   * Remove this team
   */
  const handleDelete = (evt) => {
    if (teamInfo.members.length > 1) {
      return window.alert('Remove all team members before deleting the team');
    }

    if (agent.user_metadata.pendingInvitations && agent.user_metadata.pendingInvitations.find(p => p.uuid === teamInfo.id)) {
      return window.alert('Remove all pending invitations before deleting the team');
    }

    if (window.confirm('Delete team?')) {
      deleteTeam(teamInfo.id).then(results => {
        if (results.statusCode) {
          setFlashProps({ message: results.message, variant: 'error' });
        }
        else {
          setToAgent(true);
        }
      }).catch(err => {
        console.log('TeamInfo Error');
        console.log(err);
      });
    }
  }

  /**
   * Redirect to `/agent` when this team is deleted
   */
  if (toAgent) {
    return <Redirect to={{ pathname: `/agent`, state: 'Team deleted' }} />
  }


  /**
   * Invite new agent to the team
   *
   *
   */
  const inviteToTeam = (newData) => {
    return new Promise((resolve, reject) => {
      newData.email = newData.email.trim();

      if (!newData.email.length) {
        setFlashProps({ message: 'Email can\'t be blank', variant: 'error' });
        reject();
      }
      // 2020-5-5 email regex from here: https://redux-form.com/6.5.0/examples/material-ui/
      else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(newData.email)) {
        setFlashProps({ message: 'That\'s not a valid email address', variant: 'error' });
        reject();
      }
      else {
        setIsWaiting(true);
        sendTeamInvitation(teamInfo.id, newData).then((results) => {
          if (results.message) {
            setFlashProps({ message: results.message, variant: 'warning' });
          }
          else {
            setFlashProps({ message: 'Invitation sent', variant: 'success' });
            updateAgent(results);
          }
          resolve();
        }).catch(err => {
          console.log(err);
          setFlashProps({ errors: [err], variant: 'error' });
          reject(err);
        }).finally(() => {
          setIsWaiting(false);
        });
      }
    })
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
                Team
              </Typography>
            </Grid>
            <Grid item className={classes.grid}>
              <TableContainer component={Paper}>
                <Table className={classes.table} aria-label="Team profile info">
                  <TableBody>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Name:</TableCell>
                      <TableCell  lign="left">
                        <input id="team-name-field" value={teamInfo.name || ''} disabled={agent.email !== teamInfo.leader}
                          onChange={e => {
                              if (!prevInputState.name) {
                                setPrevInputState({ name: teamInfo.name });
                              }
                              setTeamInfo({ ...teamInfo, name: e.target.value });
                            }
                          } />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Email:</TableCell>
                      <TableCell align="left">{teamInfo.leader}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            {teamInfo.leader === agent.email ?
              <Grid item className={classes.grid}>
                <TableContainer>
                  <Table className={classes.table} aria-label="Team delete">
                    <TableBody>
                      <TableRow>
                        { Object.keys(prevInputState).length ?
                          <>
                            <TableCell align="right">
                              <Button id="cancel-team-changes" variant="contained" color="secondary"
                                      onClick={e => {
                                        setTeamInfo({ ...teamInfo, ...prevInputState });
                                        setPrevInputState({});
                                      }
                              }>
                                Cancel
                              </Button>
                            </TableCell>
                            <TableCell align="left">
                              <Button id="save-team" variant="contained" color="primary" onClick={handleUpdate}>
                                Save
                              </Button>
                            </TableCell>
                          </>
                        :
                          <TableCell align="left">
                            <Button id="delete-team" variant="contained" color="secondary" onClick={handleDelete}>
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

            <Grid id="members-table" item className={classes.grid}>
              { isWaiting && <CircularProgress id="progress-spinner" className={classes.fabProgress} size={68} />}
              <MaterialTable
                title='Members'
                columns={[
                  {
                    title: 'Name',
                    field: 'name',
                    editable: 'never',
                    render: (rowData) => {
                      return rowData ? <Link href={`#agent/${rowData.user_id}`}>{rowData.name}</Link> : null;
                    }
                  },
                  {
                    title: 'Email',
                    field: 'email',
                    editComponent: (props) => {
                      return (
                        <div className="MuiFormControl-root MuiTextField-root">
                          <div className="MuiInputBase-root MuiInput-root MuiInput-underline MuiInputBase-formControl MuiInput-formControl">
                            <input
                              className="MuiInputBase-input MuiInput-input"
                              autoFocus={true}
                              type="text"
                              placeholder="Email"
                              value={props.value ? props.value : ''}
                              onChange={e => props.onChange(e.target.value)}
                              onKeyDown={evt => {
                                  if (evt.key === 'Enter') {
                                    inviteToTeam({ email: evt.target.value });
                                    props.onChange('');
                                    return;
                                  }
                                }
                              }
                            />
                          </div>
                        </div>
                      );
                    }
                  }
                ]}
                data={teamInfo.members ? teamInfo.members : []}
                options={{ search: false, paging: false }}
                actions={
                  [
                    rowData => ({
                      icon: 'delete_outline',
                      isFreeAction: false,
                      tooltip: 'Delete',
                      hidden: rowData.email === teamInfo.leader || teamInfo.leader !== agent.email,
                      onClick:() => {
                        new Promise((resolve, reject) => {
                          if (window.confirm('Remove member?')) {
                            setIsWaiting(true);

                            const headers = new Headers();
                            headers.append('Content-Type', 'application/json; charset=utf-8');
                            fetch(`/team/${teamInfo.id}/agent/${rowData.user_id}`,
                              {
                                method: 'DELETE',
                                headers,
                              }
                            )
                            .then(response => response.json())
                            .then(response => {
                              if (response.message) {
                                teamInfo.members.splice(teamInfo.members.findIndex(m => m.user_id === rowData.user_id), 1);
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
                editable={ teamInfo.leader === agent.email ? { onRowAdd: inviteToTeam } : undefined }
              />
            </Grid>
            {agent.user_metadata &&
             agent.user_metadata.pendingInvitations &&
             agent.user_metadata.pendingInvitations.length &&
             agent.user_metadata.pendingInvitations.filter(i => i.uuid === teamInfo.id).length ?
              <>
                <br />
                <Grid id="pending-invitations-table" item className={classes.grid}>
                  <MaterialTable
                    title='Pending Invitations'
                    columns={[
                      { title: 'Email', field: 'recipient', editable: 'never' }
                    ]}
                    data={agent.user_metadata.pendingInvitations.filter(i => i.uuid === teamInfo.id).length ?
                          agent.user_metadata.pendingInvitations.filter(i => i.uuid === teamInfo.id) : []}
                    options={{ search: false, paging: false }}
                    localization={{ body: { editRow: { deleteText: 'Are you sure you want to revoke this invitation?' } } }}
                    editable={ teamInfo.leader === agent.email ? {
                      onRowDelete: oldData =>
                        new Promise((resolve, reject) => {
                          rescindTeamInvitation(teamInfo.id, { email: oldData.recipient }).then((results) => {
                            if (results.error) {
                              setFlashProps({ message: results.message, variant: 'error' });
                              return reject(results);
                            }
                            setFlashProps({ message: 'Invitation canceled', variant: 'success' });
                            updateAgent(results);
                            resolve();
                          }).catch(err => {
                            console.log(err);
                            setFlashProps({ errors: [err], variant: 'error' });
                            reject(err);
                          });
                        })
                    } : undefined}
                    actions={[
                      {
                        icon: 'refresh',
                        tooltip: 'Re-send invitation',
                        onClick: (event, rowData) =>
                          new Promise((resolve, reject) => {
                            setIsWaiting(true);
                            sendTeamInvitation(teamInfo.id, { email: rowData.recipient }).then((results) => {
                              setFlashProps({ message: 'Invitation sent', variant: 'success' });
                              updateAgent(results);
                              resolve();
                            }).catch(err => {
                              console.log(err);
                              setFlashProps({ errors: [err], variant: 'error' });
                              reject(err);
                            }).finally(() => {
                              setIsWaiting(false);
                            });
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

export default TeamInfo;

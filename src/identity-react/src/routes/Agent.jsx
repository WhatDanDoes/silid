import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import { green, red } from '@material-ui/core/colors';
import Icon from '@material-ui/core/Icon';
import Button from '@material-ui/core/Button';

import { useAdminState } from '../auth/Admin';
import { useAuthState } from '../auth/Auth';
import ReactJson from 'react-json-view';
import Flash from '../components/Flash';

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
import Box from '@material-ui/core/Box';
import MuiPhoneInput from 'material-ui-phone-number';
import isMobilePhone from 'validator/lib/isMobilePhone';

import useGetAgentService from '../services/useGetAgentService';
import usePostTeamService from '../services/usePostTeamService';
import useGetTeamInviteActionService from '../services/useGetTeamInviteActionService';
import usePostOrganizationService from '../services/usePostOrganizationService';

/**
 * For SIL Locale selection
 *
 * 2020-7-27 - Swiped from https://material-ui.com/components/autocomplete/#asynchronous-requests
 */
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress'
import { useLanguageProviderState, LPFormattedMessage as FormattedMessage} from '../components/LanguageProvider';

/**
 * Names and their constituent components
 */
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Input from '@material-ui/core/Input';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';

/**
 * Styles
 */
const useStyles = makeStyles(theme =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    button: {
      margin: theme.spacing(0.5),
    },
    header: {
      marginTop: '1em',
      marginBottom: '1em',
    },
    grid: {
      width: '90%',
    },
    textField: {
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      width: '100%',
    },
    json: {
      wordWrap: 'break-word',
      wordBreak: 'break-all',
    },
    chipList: {
      display: 'flex',
      flexWrap: 'wrap',
      listStyle: 'none',
      padding: theme.spacing(0.5),
      margin: 0,
    },
    chip: {
      margin: theme.spacing(0.5),
    },
    [theme.breakpoints.down('sm')]: {
      json: {
        maxWidth: '90%'
      },
    },
    [theme.breakpoints.up('md')]: {
      grid: {
        maxWidth: '50%',
      },
      json: {
        maxWidth: '75%'
      },
    },
  })
);

const Agent = (props) => {

  const [profileData, setProfileData] = useState({});
  const [flashProps, setFlashProps] = useState({});
  const [isWaiting, setIsWaiting] = useState(false);
  const [unassignedRoles, setUnassignedRoles] = useState([]);

  const admin = useAdminState();
  const {agent} = useAuthState();

  const classes = useStyles();
  const service = useGetAgentService(props.match.params.id, admin.viewingCached);
  const { publishTeam } = usePostTeamService();
  const { publishOrganization } = usePostOrganizationService();
  const { respondToTeamInvitation } = useGetTeamInviteActionService();

  const [prevAgentInputState, setPrevAgentInputState] = useState({});

  useEffect(() => {
    if (service.status === 'loaded') {
      if (service.payload.message) {
        setFlashProps({ message: service.payload.message, variant: 'warning' });
      }
      else {
        setProfileData(service.payload);
      }
    }
  }, [service]);

  /**
   * For SIL Locale selection
   *
   * 2020-7-27 - Swiped from https://material-ui.com/components/autocomplete/#asynchronous-requests
   */
  const [localeIsOpen, setLocaleIsOpen] = React.useState(false);
  const [localeOptions, setLocaleOptions] = React.useState([]);
  const [isSettingLocale, setIsSettingLocale] = React.useState(false);
  const loadingLocale = localeIsOpen && localeOptions.length === 0;
  const { setLangCode, getFormattedMessage } = useLanguageProviderState();

  React.useEffect(() => {
    let active = true;

    if (!loadingLocale) {
      return undefined;
    }

    (async () => {
      const response = await fetch('/locale/supported');
      const languages = await response.json();

      if (active) {
        setLocaleOptions(languages);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadingLocale]);


  /**
   * Timezone stuff
   */
  const [timezoneIsOpen, setTimezoneIsOpen] = React.useState(false);
  const [timezoneOptions, setTimezoneOptions] = React.useState([]);
  const [isSettingTimezone, setIsSettingTimezone] = React.useState(false);
  const loadingTimezone = timezoneIsOpen && timezoneOptions.length === 0;

  React.useEffect(() => {
    let active = true;

    if (!loadingTimezone) {
      return undefined;
    }

    (async () => {
      const response = await fetch('/timezone');
      const timezones = await response.json();

      if (active) {
        setTimezoneOptions(timezones);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadingTimezone]);

  /**
   * Create a new team
   */
  const createTeam = (newData) => {
    return new Promise((resolve, reject) => {
      newData.name = newData.name.trim();
      if (!newData.name.length) {
        setFlashProps({ message: getFormattedMessage('Team name can\'t be blank'), variant: 'error' });
        reject();
      }
      else {
        setIsWaiting(true);
        publishTeam(newData).then(profile => {;
          if (profile.statusCode) {
            setFlashProps({ message: profile.message, variant: 'error' });
          }
          else if (profile.errors) {
            setFlashProps({ errors: profile.errors, variant: 'error' });
          }
          else {
            setProfileData(profile);
          }
          resolve();
        }).catch(reject)
        .finally(() => {
          setIsWaiting(false);
        });
      }
    })
  };

  /**
   * Create a new organization
   */
  const createOrganization = (newData) => {
    return new Promise((resolve, reject) => {
      newData.name = newData.name.trim();
      if (!newData.name.length) {
        setFlashProps({ message: getFormattedMessage('Organization name can\'t be blank'), variant: 'error' });
        reject();
      }
      else {
        setIsWaiting(true);
        publishOrganization(newData).then(profile => {;
          if (profile.statusCode) {
            setFlashProps({ message: profile.message, variant: 'error' });
          }
          else if (profile.errors) {
            setFlashProps({ errors: profile.errors, variant: 'error' });
          }
          else {
            setProfileData(profile);
          }
          resolve();
        }).catch(reject)
        .finally(() => {
          setIsWaiting(false);
        });
      }
    });
  };


  return (
    <div className={classes.root}>
      <Grid container direction="column" justify="center" alignItems="center">
        <Grid item>
          <Typography variant="body2" color="textSecondary" component="p">
            {service.status === 'loading' && <FormattedMessage id='Loading...' />}
          </Typography>
        </Grid>
        <Grid item>
          <Typography className={classes.header} variant="h5" component="h3">
            <FormattedMessage id='Profile' />
          </Typography>
        </Grid>
        {service.status === 'loaded' && service.payload ?
          <>
            <Grid item className={classes.grid}>
              <TableContainer id="profile-table" component={Paper}>
                <Table className={classes.table} aria-label={getFormattedMessage('Agent profile info')}>
                  <TableBody>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row" style={{ verticalAlign: 'top', paddingTop: '2em' }}>
                        <FormattedMessage id='Name' />:
                      </TableCell>
                      <TableCell align="left">
                        <Accordion id='name-components-accordion'>
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon id='expand-name-components' />}
                            aria-label='Expand name details'
                            aria-controls='expand-name-details'
                            id='expand-name-details'
                          >
                            <input id='agent-name-field'
                              value={profileData.name || ''}
                              disabled={!profileData.email_verified || (agent.email !== profileData.email && !admin.isEnabled)}
                              onClick={(event) => event.stopPropagation()}
                              onFocus={(event) => event.stopPropagation()}
                              onChange={e => {
                                  if (!prevAgentInputState.name) {
                                    setPrevAgentInputState({ ...prevAgentInputState, name: profileData.name });
                                  }
                                  setProfileData({ ...profileData, name: e.target.value });
                                }
                              } />
                          </AccordionSummary>
                          <AccordionDetails id='agent-name-details'>
                            <Typography color='textSecondary' component='div'>
                              <FormControl>
                                <InputLabel htmlFor='component-simple'><FormattedMessage id='Family name' /></InputLabel>
                                <Input id='agent-family-name-field'
                                  disabled={!profileData.email_verified || (agent.email !== profileData.email && !admin.isEnabled)}
                                  value={profileData.family_name || ''}
                                  onChange={e => {
                                      if (!prevAgentInputState.family_name) {
                                        setPrevAgentInputState({ ...prevAgentInputState, family_name: profileData.family_name });
                                      }
                                      setProfileData({ ...profileData, family_name: e.target.value });
                                    }
                                  } />
                              </FormControl>
                              <FormControl>
                                <InputLabel htmlFor='component-simple'><FormattedMessage id='Given name' /></InputLabel>
                                <Input id='agent-given-name-field'
                                  disabled={!profileData.email_verified || (agent.email !== profileData.email && !admin.isEnabled)}
                                  value={profileData.given_name || ''}
                                  onChange={e => {
                                      if (!prevAgentInputState.given_name) {
                                        setPrevAgentInputState({ ...prevAgentInputState, given_name: profileData.given_name });
                                      }
                                      setProfileData({ ...profileData, given_name: e.target.value });
                                    }
                                  } />
                              </FormControl>
                              <FormControl>
                                <InputLabel htmlFor='component-simple'><FormattedMessage id='Nickname' /></InputLabel>
                                <Input id='agent-nickname-field'
                                  disabled={!profileData.email_verified || (agent.email !== profileData.email && !admin.isEnabled)}
                                  value={profileData.nickname || ''}
                                  onChange={e => {
                                      if (!prevAgentInputState.nickname) {
                                        setPrevAgentInputState({ ...prevAgentInputState, nickname: profileData.nickname });
                                      }
                                      setProfileData({ ...profileData, nickname: e.target.value });
                                    }
                                  } />
                              </FormControl>
                            </Typography>
                          </AccordionDetails>
                        </Accordion>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='Email' />:</TableCell>
                      <TableCell align="left">{profileData.email}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='Phone' />:</TableCell>
                      <TableCell align="left">
                        <MuiPhoneInput
                          id="phone-number-field"
                          placeholder={getFormattedMessage('Set your phone number')}
                          defaultCountry={'us'}
                          onlyCountries={['us', 'ca']}
                          disabled={!profileData.email_verified || (profileData.email !== agent.email && !admin.isEnabled)}
                          value={profileData.user_metadata && profileData.user_metadata.phone_number ? profileData.user_metadata.phone_number : undefined}
                          onChange={value => {
                            if (!prevAgentInputState.user_metadata || !prevAgentInputState.user_metadata.phone_number) {
                              setPrevAgentInputState({ ...prevAgentInputState, user_metadata: {phone_number: value} });
                            }
                            setProfileData({ ...profileData, user_metadata: {...profileData.user_metadata, phone_number: value} });
                          }
                        }/>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='Timezone' />:</TableCell>
                      <TableCell align="left">
                        <Autocomplete
                          id="timezone-dropdown"
                          style={{ width: '100%' }}
                          open={timezoneIsOpen}
                          onOpen={() => {
                            setTimezoneIsOpen(true);
                          }}
                          onClose={async(event, value) => {
                            setTimezoneIsOpen(false);
                          }}
                          onChange={async (event, value) => {
                            if (value) {
                              return new Promise((resolve, reject) => {
                                setIsSettingTimezone(true);
                                const headers = new Headers();
                                headers.append('Access-Control-Allow-Credentials', 'true');
                                headers.append('Content-Type', 'application/json; charset=utf-8');
                                fetch(`/timezone/${profileData.user_id}`,
                                  {
                                    method: 'PUT',
                                    headers,
                                    body: JSON.stringify({timezone: value.name})
                                  }
                                )
                                .then(response => response.json())
                                .then(async(response) => {
                                  if (response.message) {
                                    setFlashProps({ message: response.message, variant: 'error' });
                                  }
                                  else {
                                    setProfileData(response);
                                    setFlashProps({ message: getFormattedMessage('Timezone updated'), variant: 'success' });
                                  }

                                  resolve();
                                })
                                .catch(error => {
                                  setFlashProps({ message: error.message, variant: 'error' });
                                  reject(error);
                                }).finally(() => {
                                  setIsSettingTimezone(false);
                                });
                              });
                            }
                          }}
                          getOptionSelected={(option, value) => option.name === value.name}
                          getOptionLabel={(option) => `${option.name}`}
                          options={timezoneOptions}
                          loading={loadingTimezone}
                          disabled={!profileData.email_verified || (profileData.email !== agent.email && !admin.isEnabled)}
                          value={profileData.user_metadata && profileData.user_metadata.zoneinfo ? profileData.user_metadata.zoneinfo : { name: '' }}
                          autoHighlight
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={getFormattedMessage('Set your timezone')}
                              variant="outlined"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <React.Fragment>
                                    {loadingTimezone || isSettingTimezone ? <CircularProgress id="timezone-spinner" color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                  </React.Fragment>
                                ),
                              }}
                            />
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='Provider Locale' />:</TableCell>
                      <TableCell align="left">{profileData.locale}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='SIL Locale' />:</TableCell>
                      <TableCell align="left">
                        <Autocomplete
                          id="sil-local-dropdown"
                          style={{ width: '100%' }}
                          open={localeIsOpen}
                          onOpen={() => {
                            setLocaleIsOpen(true);
                          }}
                          onClose={async(event, value) => {
                            setLocaleIsOpen(false);
                          }}
                          onChange={async (event, value) => {
                            if (value && value.iso6393) {
                              return new Promise((resolve, reject) => {
                                setIsSettingLocale(true);
                                const headers = new Headers();
                                headers.append('Access-Control-Allow-Credentials', 'true');
                                headers.append('Content-Type', 'application/json; charset=utf-8');
                                fetch(`/locale/${value.iso6393}`,
                                  {
                                    method: 'PUT',
                                    headers,
                                  }
                                )
                                .then(response => response.json())
                                .then(async(response) => {
                                  if (response.message) {
                                    setFlashProps({ message: response.message, variant: 'error' });
                                  }
                                  else {
                                    setProfileData(response);
                                    setFlashProps({ message: getFormattedMessage('Preferred SIL language updated'), variant: 'success' });
                                    setLocaleOptions(localeOptions);
                                    setLangCode(response.user_metadata.silLocale.iso6393);
                                  }
                                  resolve();
                                })
                                .catch(error => {
                                  setFlashProps({ message: error.message, variant: 'error' });
                                  reject(error);
                                }).finally(() => {
                                  setIsSettingLocale(false);
                                });
                              });
                            }
                          }}
                          getOptionSelected={(option, value) => option.name === value.name}
                          getOptionLabel={(option) => `${option.name}`}
                          options={localeOptions}
                          loading={loadingLocale}
                          disabled={profileData.email !== agent.email && !agent.isAdmin}
                          value={profileData.user_metadata && profileData.user_metadata.silLocale ? profileData.user_metadata.silLocale : { name: 'English', iso6393: 'eng' }}
                          autoHighlight
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={getFormattedMessage('Set SIL language preference')}
                              variant="outlined"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <React.Fragment>
                                    {loadingLocale || isSettingLocale ? <CircularProgress id="set-locale-spinner" color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                  </React.Fragment>
                                ),
                              }}
                            />
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    {profileData.roles && (
                      <TableRow>
                        <TableCell align="right" component="th" scope="row"><FormattedMessage id='Roles' />:</TableCell>
                        <TableCell id="assigned-roles" align="left" component="td" className={classes.chipList}>
                          {profileData.roles.map(data => {
                            return (
                              <Chip
                                key={data.id}
                                label={data.name}
                                className={classes.chip}
                                onDelete={admin.isEnabled && data.name !== 'viewer' ?
                                  () => {
                                    const headers = new Headers();
                                    headers.append('Content-Type', 'application/json; charset=utf-8');
                                    fetch(`/role/${data.id}/agent/${profileData.user_id}`,
                                      {
                                        method: 'DELETE',
                                        headers,
                                      }
                                    )
                                    .then(response => response.json())
                                    .then(response => {
                                      if (response.message) {
                                        setFlashProps({ message: response.message, variant: 'warning' });
                                      }
                                      else {
                                        setProfileData(response);
                                        setUnassignedRoles([]);
                                      }
                                    })
                                    .catch(error => {
                                      setFlashProps({ message: error.message, variant: 'error' });
                                    });
                                  }
                                : undefined}
                              />
                            );
                          })}
                          {admin.isEnabled && !unassignedRoles.length && (
                            <Chip
                              key="assign-role"
                              id="assign-role"
                              style={{ backgroundColor: '#ffffff' }}
                              className={classes.chip}
                              label={<Icon style={{ color: green[500] }}>add_circle</Icon>}
                              onClick={() => {
                                setIsWaiting(true);
                                const headers = new Headers();
                                headers.append('Content-Type', 'application/json; charset=utf-8');
                                fetch('/role',
                                  {
                                    method: 'GET',
                                    headers,
                                  }
                                )
                                .then(response => response.json())
                                .then(response => {
                                  if (response.message) {
                                    setFlashProps({ message: response.message, variant: 'warning' });
                                  }
                                  else {
                                    const roles = response.filter(role => {
                                      for (let r of profileData.roles) {
                                        if (r.id === role.id) {
                                          return false;
                                        }
                                      }
                                      return true;
                                    });
                                    setUnassignedRoles(roles);
                                  }
                                })
                                .catch(error => {
                                  setFlashProps({ message: error.message, variant: 'error' });
                                }).finally(() => {
                                  setIsWaiting(false);
                                });
                              }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {unassignedRoles.length ?
                      <TableRow>
                        <TableCell align="right" component="th" scope="row">Available roles:</TableCell>
                        <TableCell id="unassigned-roles" align="left" component="td" className={classes.chipList}>
                          {unassignedRoles.map(data => {
                            return (
                              <Chip
                                key={data.id}
                                label={data.name}
                                className={classes.chip}
                                onClick={() => {
                                  setIsWaiting(true);
                                  const headers = new Headers();
                                  headers.append('Content-Type', 'application/json; charset=utf-8');
                                  fetch(`/role/${data.id}/agent/${profileData.user_id}`,
                                    {
                                      method: 'PUT',
                                      headers,
                                    }
                                  )
                                  .then(response => response.json())
                                  .then(response => {
                                    if (response.message) {
                                      setFlashProps({ message: response.message, variant: 'warning' });
                                    }
                                    else {
                                      setProfileData(response);
                                      const roleIndex = unassignedRoles.findIndex(role => role.id === data.id);
                                      const remainingRoles = [...unassignedRoles];
                                      remainingRoles.splice(roleIndex, 1);
                                      setUnassignedRoles(remainingRoles);
                                    }
                                  })
                                  .catch(error => {
                                    setFlashProps({ message: error.message, variant: 'error' });
                                  })
                                  .finally(() => {
                                    setIsWaiting(false);
                                  });
                                }}
                              />
                            );
                          })}
                          <li key="close-unassigned-roles">
                            <Chip
                              id="close-unassigned-roles"
                              style={{ backgroundColor: '#ffffff' }}
                              className={classes.chip}
                              label={<Icon style={{ color: red[500] }}>close</Icon>}
                              onClick={() => {
                                setUnassignedRoles([]);
                              }}
                            />
                          </li>
                        </TableCell>
                      </TableRow>
                    : undefined}
                      { Object.keys(prevAgentInputState).length ?
                        <TableRow>
                          <TableCell align="center" colSpan={2}>
                            <Box mr={2} display="inline">
                              <Button id="cancel-agent-changes" variant="contained" color="secondary" disabled={isWaiting}
                                onClick={e => {
                                  setProfileData({ ...profileData, ...prevAgentInputState });
                                  setPrevAgentInputState({});
                                }
                              }>
                                <FormattedMessage id='Cancel' />
                              </Button>
                            </Box>
                            <Button id="save-agent" variant="contained" color="primary" disabled={isWaiting}
                              onClick={() => {
                                const changes = {};
                                for (let p in prevAgentInputState) {
                                  if (p === 'user_metadata') {
                                    for (let u in profileData.user_metadata) {
                                      if (['phone_number'].indexOf(u) > -1) {
                                        changes[u] = profileData.user_metadata[u].trim();
                                        if (!changes[u].length || (u === 'phone_number' && !isMobilePhone(changes[u]))) {
                                          setFlashProps({ message: getFormattedMessage('Missing profile data'), variant: 'error' });
                                          return;
                                        }
                                      }
                                    }
                                  }
                                  else {
                                    changes[p] = profileData[p].trim();

                                    if (!changes[p].length) {
                                      setFlashProps({ message: getFormattedMessage('Missing profile data'), variant: 'error' });
                                      return;
                                    }
                                  }
                                }

                                setIsWaiting(true);
                                const headers = new Headers();
                                headers.append('Content-Type', 'application/json; charset=utf-8');
                                fetch(`/agent/${profileData.user_id}`,
                                  {
                                    method: 'PATCH',
                                    body: JSON.stringify(changes),
                                    headers,
                                  }
                                )
                                .then(response => response.json())
                                .then(response => {
                                  if (response.message) {
                                    setFlashProps({ message: getFormattedMessage(response.message), variant: 'warning' });
                                  }
                                  else {
                                    setProfileData(response);
                                    setPrevAgentInputState({});
                                    setFlashProps({ message: getFormattedMessage('Agent updated'), variant: 'success' });
                                  }
                                })
                                .catch(error => {
                                  setFlashProps({ message: getFormattedMessage(error.message), variant: 'error' });
                                })
                                .finally(() => {
                                  setIsWaiting(false);
                                });
                              }
                            }>
                              <FormattedMessage id='Save' />
                            </Button>
                          </TableCell>
                        </TableRow>
                      : undefined}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            {!profileData.email_verified ?
              <Grid item className={classes.grid}>
                <TableContainer>
                  <Table className={classes.table} aria-label={getFormattedMessage('Resend Verification Email')}>
                    <TableBody>
                      <TableRow>
                        <TableCell align="center">
                          {profileData.email === agent.email ?
                            <Button
                              id="resend-verification-email-button"
                              variant="contained"
                              color="secondary"
                              onClick={() => {
                                const headers = new Headers();
                                headers.append('Content-Type', 'application/json; charset=utf-8');
                                fetch('/agent/verify',
                                  {
                                    method: 'POST',
                                    body: JSON.stringify({ id: profileData.user_id }),
                                    headers,
                                  }
                                )
                                .then(response => response.json())
                                .then(response => {
                                  if (response.message) {
                                    setFlashProps({ message: getFormattedMessage(response.message), variant: 'success' });
                                  }
                                  else {
                                    setFlashProps({ message: getFormattedMessage('Could not verify email was sent'), variant: 'warning' });
                                  }
                                })
                                .catch(error => {
                                  setFlashProps({ message: error.message, variant: 'error' });
                                });
                              }}
                            >
                              <FormattedMessage id='Resend Verification Email' />
                            </Button>
                          :
                            <div id='verification-status' style={{ color: 'red' }}>
                              <FormattedMessage id='This is an unverified account' />
                            </div>
                          }
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            : ''}
            {profileData.user_metadata &&
             profileData.user_metadata.rsvps &&
             profileData.user_metadata.rsvps.length ?
              <>
                <Grid id="rsvps-table" item className={classes.grid}>
                  <MaterialTable
                    title={getFormattedMessage('RSVPs')}
                    isLoading={isWaiting}
                    columns={[
                      { title: getFormattedMessage('Name'), field: 'data.name', editable: 'never' },
                      { title: getFormattedMessage('Type'), field: 'type', editable: 'never' },
                    ]}
                    data={profileData.user_metadata ? profileData.user_metadata.rsvps : []}
                    options={{ search: false, paging: false }}
                    localization={{
                      body: {
                        editRow: {
                          deleteText: getFormattedMessage('Are you sure you want to ignore this invitation?')
                        }
                      }
                    }}
                    editable={profileData.email_verified ? {
                      onRowDelete: (oldData) => new Promise((resolve, reject) => {
                        respondToTeamInvitation(oldData.uuid, 'reject').then(results => {
                          if (results.error) {
                            setFlashProps({ message: results.message, variant: 'error' });
                            return reject(results);
                          }
                          setFlashProps({ message: getFormattedMessage('Invitation ignored'), variant: 'warning' });
                          setProfileData(results);
                          resolve();
                        }).catch(err => {
                          reject(err);
                        });
                      }),
                    } : undefined}
                    actions={profileData.email_verified ? [
                      {
                        icon: 'check',
                        tooltip: getFormattedMessage('Accept invitation'),
                        onClick: (event, rowData) =>
                          new Promise((resolve, reject) => {
                            setIsWaiting(true);
                            respondToTeamInvitation(rowData.uuid, 'accept').then(results => {
                              if (results.error) {
                                setFlashProps({ message: results.message, variant: 'error' });
                                return reject(results);
                              }
                              setFlashProps({ message: getFormattedMessage('Welcome to the team'), variant: 'success' });
                              setProfileData(results);
                              resolve();
                            }).catch(err => {
                              reject(err);
                            }).finally(() => {
                              setIsWaiting(false);
                            });
                          })
                      }
                    ]: []}
                  />
                </Grid>
                <br />
              </>
            : '' }
            {profileData.roles && profileData.roles.find(r => r.name === 'organizer') ?
              <Grid id="organizations-table" item className={classes.grid}>
                <MaterialTable
                  title={getFormattedMessage('Organizations')}
                  isLoading={isWaiting}
                  columns={[
                    {
                      title: getFormattedMessage('Name'),
                      field: 'name',
                      render: rowData => <Link href={`#organization/${rowData.id}`}>{rowData.name}</Link>,
                      editComponent: (props) => {
                        return (
                          <MTableEditField
                            autoFocus={true}
                            type="text"
                            maxLength="128"
                            placeholder={getFormattedMessage('Name')}
                            columnDef={props.columnDef}
                            value={props.value ? props.value : ''}
                            onChange={value => props.onChange(value) }
                            onKeyDown={evt => {
                                if (evt.key === 'Enter') {
                                  createOrganization({ name: evt.target.value });
                                  props.onChange('');
                                  return;
                                }
                              }
                            }
                          />
                        );
                      }
                    },
                    { title: getFormattedMessage('Organizer'), field: 'organizer', editable: 'never' }
                  ]}
                  data={profileData.user_metadata ? profileData.user_metadata.organizations : []}
                  options={{ search: false, paging: false }}
                  editable={ profileData.email === agent.email ? { onRowAdd: createOrganization }: undefined}
                />
              </Grid>
            : '' }
            <Grid id="teams-table" item className={classes.grid}>
              <MaterialTable
                title={getFormattedMessage('Teams')}
                isLoading={isWaiting}
                columns={[
                  {
                    title: getFormattedMessage('Name'),
                    field: 'name',
                    render: rowData => {return profileData.email_verified ? <Link href={`#team/${rowData.id}`}>{rowData.name}</Link> : rowData.name},
                    editComponent: (props) => {
                      return (
                        <MTableEditField
                          autoFocus={true}
                          type="text"
                          maxLength="128"
                          placeholder={getFormattedMessage('Name')}
                          columnDef={props.columnDef}
                          value={props.value ? props.value : ''}
                          onChange={value => props.onChange(value) }
                          onKeyDown={evt => {
                              if (evt.key === 'Enter') {
                                createTeam({ name: evt.target.value });
                                props.onChange('');
                                return;
                              }
                            }
                          }
                        />
                      );
                    }
                  },
                  { title: getFormattedMessage('Leader'), field: 'leader', editable: 'never' }
                ]}
                data={profileData.user_metadata ? profileData.user_metadata.teams : []}
                options={{ search: false, paging: false }}
                editable={ (profileData.email === agent.email && profileData.email_verified) ? { onRowAdd: createTeam }: undefined}
                localization={{
                  header: {
                    name: getFormattedMessage('Name'),
                    leader: getFormattedMessage('Leader')
                  },
                  body: {
                    emptyDataSourceMessage: getFormattedMessage('No records to display'),
                  }
                }}
              />
            </Grid>
            <Grid item>
              <Typography className={classes.header} variant="h5" component="h3">
                <FormattedMessage id='Social Data' />
              </Typography>
            </Grid>
            <Grid item className={classes.json}>
              <ReactJson
                id='social-data'
                src={profileData}
                name={null}
                collapsed={true}
                collapseStringsAfterLength={80}
                displayDataTypes={false}
                displayObjectSize={false}
                shouldCollapse={(field) => field.name[0] === '_' }
              />
            </Grid>
          </>
        : ''}
      </Grid>
      { props.location.state ? <Flash message={props.location.state} variant="success" /> : '' }
      { flashProps.message ? <Flash message={flashProps.message} variant={flashProps.variant} onClose={() => setFlashProps({})} /> : '' }
      { flashProps.errors ? flashProps.errors.map((error, index) => <Flash message={error.message}
                                                                           variant={flashProps.variant}
                                                                           onClose={() => setFlashProps({})}
                                                                           key={`flash-${index}`} />) : '' }
    </div>
  )
};

export default Agent;


import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
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
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';
import MuiPhoneInput from 'material-ui-phone-number';
import isMobilePhone from 'validator/lib/isMobilePhone';

import useGetAgentService from '../services/useGetAgentService';

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
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [flashProps, setFlashProps] = useState({});
  const [isWaiting, setIsWaiting] = useState(false);
  const [unassignedRoles, setUnassignedRoles] = useState([]);
  const [isIdpAuthenticated, setIsIdpAuthenticated] = React.useState(true);

  const admin = useAdminState();
  const {agent} = useAuthState();

  const classes = useStyles();
  const service = useGetAgentService(props.match.params.id, admin.viewingCached);

  const [prevAgentInputState, setPrevAgentInputState] = useState({});

  useEffect(() => {
    if (service.status === 'loaded') {
      if (service.payload.message) {
        setFlashProps({ message: service.payload.message, variant: 'warning' });
      }
      else {
        setProfileData(service.payload);

        let i = service.payload.user_id.indexOf('|');
        let id = service.payload.user_id.slice(i + 1);
        setLinkedAccounts(service.payload.identities.filter(i => i.user_id !== id));

        setIsIdpAuthenticated(!/^auth0\|*/.test(service.payload.user_id));
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

  /**
   * For linkable accounts
   */
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(false);
  const [linkableAccounts, setLinkableAccounts] = React.useState([]);
  const [isLinkingAccounts, setIsLinkingAccounts] = React.useState(false);

  /**
   * SIL Locales
   */
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
                              disabled={!profileData.email_verified || isIdpAuthenticated || (agent.email !== profileData.email && !admin.isEnabled)}
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
                                  disabled={!profileData.email_verified || isIdpAuthenticated || (agent.email !== profileData.email && !admin.isEnabled)}
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
                                  disabled={!profileData.email_verified || isIdpAuthenticated || (agent.email !== profileData.email && !admin.isEnabled)}
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
                                  disabled={!profileData.email_verified || isIdpAuthenticated || (agent.email !== profileData.email && !admin.isEnabled)}
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

            {profileData.email_verified && (profileData.email === agent.email || agent.isOrganizer || agent.isSuper) ?
              <Grid item className={classes.grid}>
                {linkedAccounts.length ?
                  <>
                    <Grid item>
                      <Typography className={classes.header} variant="h5" component="h3">
                        <FormattedMessage id='Linked Accounts' />
                      </Typography>
                    </Grid>
                    <TableContainer>
                      <Table id="linked-accounts" className={classes.table} aria-label={getFormattedMessage('Linkable Accounts')}>
                        <TableHead>
                          <TableRow>
                            <TableCell align="center">
                              connection
                            </TableCell>
                            <TableCell align="center">
                              isSocial
                            </TableCell>
                            <TableCell align="center">
                              provider
                            </TableCell>
                            <TableCell align="center">
                              user_id
                            </TableCell>
                            <TableCell align="center">
                              actions
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          { linkedAccounts.map(account => (

                            <TableRow key={account.user_id}>
                              <TableCell className="connection" align="center">
                                {account.connection}
                              </TableCell>
                              <TableCell className="is-social" align="center">
                                {`${account.isSocial}`}
                              </TableCell>
                              <TableCell className="provider" align="center">
                                {account.provider}
                              </TableCell>
                              <TableCell className="user-id" align="center">
                                {account.user_id}
                              </TableCell>
                              <TableCell className="action" align="center">
                                <Button
                                  className="unlink-accounts"
                                  variant="contained"
                                  color="primary"
                                  disabled={isLinkingAccounts || (agent.email !== profileData.email && !admin.isEnabled && !agent.isOrganizer && !agent.isSuper)}
                                  onClick={() => {
                                    setIsLinkingAccounts(true);
                                    const headers = new Headers();
                                    headers.append('Content-Type', 'application/json; charset=utf-8');

                                    let currentlyLinked = linkedAccounts.find(l => l.provider === account.provider && l.user_id === account.user_id);


                                    let unlinkUrl = `/agent/link/${account.provider}/${account.user_id}`;
                                    if ((agent.isOrganizer || agent.isSuper) && agent.email !== profileData.email) {
                                      unlinkUrl += `/${profileData.user_id}`;
                                    }

                                    fetch(unlinkUrl,
                                      {
                                        method: 'DELETE',
                                        headers,
                                      }
                                    )
                                    .then(response => response.json())
                                    .then(response => {
                                      if (response.length) {

                                        // Remove from linkedAccounts
                                        let linked = [];
                                        for (let r of response) {
                                          linked.concat(linkableAccounts.filter(l => l.user_id !== r.user_id && l.provider !== r.provider));
                                        }
                                        setLinkedAccounts(linked);
                                        setLinkableAccounts([...linkableAccounts, currentlyLinked]);

                                        setFlashProps({ message: getFormattedMessage('Accounts unlinked'), variant: 'success' });
                                      }
                                      else {
                                        setFlashProps({ message: getFormattedMessage('Could not verify accounts were unlinked'), variant: 'warning' });
                                      }
                                    })
                                    .catch(error => {
                                      setFlashProps({ message: error.message, variant: 'error' });
                                    })
                                    .finally(() => {
                                      setIsLinkingAccounts(false);
                                    });
                                  }}
                                >
                                  <FormattedMessage id="Unlink" />
                                  <React.Fragment>
                                    {isLinkingAccounts ? <CircularProgress className="link-account-spinner" color="inherit" size={20} /> : null}
                                  </React.Fragment>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                : '' }
                <Typography className={classes.header} variant="h5" component="h3">
                  <Button
                    id="find-linkable-accounts"
                    variant="contained"
                    color="primary"
                    disabled={isLoadingAccounts || (agent.email !== profileData.email && !admin.isEnabled && !agent.isOrganizer && !agent.isSuper)}
                    onClick={() => {
                      setIsLoadingAccounts(true);

                      const headers = new Headers();
                      headers.append('Content-Type', 'application/json; charset=utf-8');

                      let profilesUrl = '/agent/profiles';
                      if ((agent.isOrganizer || agent.isSuper) && agent.email !== profileData.email) {
                        profilesUrl += `/${profileData.email}`;
                      }

                      fetch(profilesUrl,
                        {
                          method: 'GET',
                          headers,
                        }
                      )
                      .then(response => response.json())
                      .then(response => {

                        // No need to link the current profile
                        response = response.filter(r => r.user_id !== profileData.user_id);

                        if (!response.length) {
                          setFlashProps({ message: getFormattedMessage('No linkable accounts'), variant: 'success' });
                        }
                        else {
                          let identities = [];

                          for (let r of response) {
                            let i = r.user_id.indexOf('|');
                            let provider = r.user_id.slice(0, i);
                            let id = r.user_id.slice(i + 1);

                            for (let i of r.identities) {
                              if (i.provider === provider && i.user_id === id) {
                                identities.push(i);
                              }
                            }
                          }

                          setLinkableAccounts(identities);
                        }
                      })
                      .catch(error => {
                        setFlashProps({ message: error.message, variant: 'error' });
                      })
                      .finally(() => {
                        setIsLoadingAccounts(false);
                      });
                    }}
                  >
                    <FormattedMessage id='Find Linkable Accounts' />
                    <React.Fragment>
                      {isLoadingAccounts ? <CircularProgress id="load-linkable-spinner" color="inherit" size={20} /> : null}
                    </React.Fragment>
                  </Button>
                </Typography>

                {linkableAccounts.length  ?
                  <>
                    <Grid item>
                      <Typography className={classes.header} variant="h5" component="h3">
                        <FormattedMessage id='Linkable Accounts' />
                      </Typography>
                    </Grid>
                    <TableContainer>
                      <Table id="linkable-accounts" className={classes.table} aria-label={getFormattedMessage('Linkable Accounts')}>
                        <TableHead>
                          <TableRow>
                            <TableCell align="center">
                              connection
                            </TableCell>
                            <TableCell align="center">
                              isSocial
                            </TableCell>
                            <TableCell align="center">
                              provider
                            </TableCell>
                            <TableCell align="center">
                              user_id
                            </TableCell>
                            <TableCell align="center">
                              actions
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          { linkableAccounts.map(account => (
                            <TableRow key={account.user_id}>
                              <TableCell className="connection" align="center">
                                {account.connection}
                              </TableCell>
                              <TableCell className="is-social" align="center">
                                {`${account.isSocial}`}
                              </TableCell>
                              <TableCell className="provider" align="center">
                                {account.provider}
                              </TableCell>
                              <TableCell className="user-id" align="center">
                                {account.user_id}
                              </TableCell>
                              <TableCell className="action" align="center">
                                <Button
                                  className="link-accounts"
                                  variant="contained"
                                  color="primary"
                                  disabled={isLoadingAccounts || (agent.email !== profileData.email && !admin.isEnabled && !agent.isOrganizer && !agent.isSuper)}
                                  onClick={() => {
                                    setIsLinkingAccounts(true);
                                    const headers = new Headers();
                                    headers.append('Content-Type', 'application/json; charset=utf-8');

                                    let linkUrl = '/agent/link';

                                    if ((agent.isSuper || agent.isOrganizer) && agent.email !== profileData.email) {
                                      linkUrl += `/${profileData.user_id}`;
                                    }

                                    fetch(linkUrl,
                                      {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                          // From where do I get connection_id?
                                          //connection_id: account.connection,
                                          user_id: account.user_id,
                                          provider: account.provider,
                                        }),
                                        headers,
                                      }
                                    )
                                    .then(response => response.json())
                                    .then(response => {
                                      // Remove newly linked account from linkableAccounts
                                      let linkables = [...linkableAccounts];
                                      for (let r of response) {
                                        let index = linkables.findIndex(l => l.user_id === r.user_id);
                                        if (index > -1) {
                                          linkables.splice(index, 1);
                                        }
                                      }
                                      setLinkableAccounts(linkables);

                                      // Remove primary account from returned list of linked accounts
                                      let i = profileData.user_id.indexOf('|');
                                      let primary_id = profileData.user_id.slice(i + 1);

                                      let linked = response.filter(r => r.user_id !== primary_id);

                                      setLinkedAccounts(linked);
                                      setFlashProps({ message: getFormattedMessage('Accounts linked'), variant: 'success' });
                                    })
                                    .catch(error => {
                                      setFlashProps({ message: error.message, variant: 'error' });
                                    })
                                    .finally(() => {
                                      setIsLinkingAccounts(false);
                                    });
                                  }}
                                >
                                  <FormattedMessage id="Link" />
                                  <React.Fragment>
                                    {isLinkingAccounts ? <CircularProgress className="link-account-spinner" color="inherit" size={20} /> : null}
                                  </React.Fragment>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                : '' }
              </Grid>
            : ''}

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

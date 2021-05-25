import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Fab from '@material-ui/core/Fab';
import AddIcon from '@material-ui/icons/Add';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Button from '@material-ui/core/Button';
import Flash from '../components/Flash';
import OrgCreateForm from '../components/OrgCreateForm';
// Remove this junk later
import InboxIcon from '@material-ui/icons/MoveToInbox';

import useGetOrganizationService from '../services/useGetOrganizationService';

import { useLanguageProviderState, LPFormattedMessage as FormattedMessage} from '../components/LanguageProvider';

const useStyles = makeStyles((theme: Theme) =>
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

const Organization = (props) => {
  const [formVisible, toggleFormVisible] = useState(false);
  const [orgList, setOrgList] = useState({ results: [] });
  const [flashProps, setFlashProps] = useState({});

  const classes = useStyles();
  const service = useGetOrganizationService();

  const { getFormattedMessage } = useLanguageProviderState();

  useEffect(() => {
    if (service.status === 'loaded') {
      if (service.payload.error) {
        setFlashProps({ errors: [service.payload], variant: 'error' });
      }
      else {
        setOrgList(service.payload);
      }
    }
  }, [service]);

  function ListItemLink(props:any) {
    return <ListItem className='list-item' button component="a" {...props} />;
  }

  return (
    <div className="organization">
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h5" component="h3">
            <FormattedMessage id='Organizations' />
          </Typography>
          { props.location.state ? <Flash message={getFormattedMessage(props.location.state)} variant="success" /> : '' }
          { flashProps.errors ? flashProps.errors.map((error, index) => <Flash message={getFormattedMessage(error.message)} variant={flashProps.variant} key={`flash-${index}`} />) : '' }
          { formVisible ?
              <React.Fragment>
                <OrgCreateForm
                  done={(results) => {
                    toggleFormVisible(false);
                    if (results.errors) {
                      setFlashProps({errors: results.errors, variant: 'error' });
                    }
                    else {
                      setOrgList({ results: [results, ...orgList.results] });
                    }
                  }}/>
                <Button id="cancel-changes"
                  variant="contained" color="secondary"
                  onClick={() => {
                    toggleFormVisible(false)
                  }}>
                    <FormattedMessage id='Cancel' />
                </Button>
              </React.Fragment>
            :
              <Fab id="add-organization" color="secondary" aria-label={getFormattedMessage('add')} className={classes.margin}>
                <AddIcon onClick={() => toggleFormVisible(true)} />
              </Fab>
          }

          <Typography variant="body2" color="textSecondary" component="div">
          {service.status === 'loading' && <div><FormattedMessage id='Loading...' /></div>}
          {service.status === 'loaded' && orgList.results.length ?
            <List id="organization-list">
              { orgList.results.map(org => (
                <ListItem button className='organization-button' key={`Organizations-${org.id}`}>
                  <ListItemIcon><InboxIcon /></ListItemIcon>
                  <ListItemLink href={`#organization/${org.id}`}>
                    <ListItemText primary={org.name} />
                  </ListItemLink>
                </ListItem>
              ))}
            </List> : ''}
          {service.status === 'error' && (
            <div>Error, the backend moved to the dark side.</div>
          )}
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default Organization;

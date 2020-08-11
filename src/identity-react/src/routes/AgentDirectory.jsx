import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Flash from '../components/Flash';
import MaterialTable from 'material-table';
import { TablePagination } from '@material-ui/core';

import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import Grid from '@material-ui/core/Grid';

import useGetAgentDirectoryService from '../services/useGetAgentDirectoryService';

import { useLanguageProviderState } from '../components/LanguageProvider';

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

const AgentDirectory = (props) => {

  const [agentList, setAgentList] = useState({ results: [] });
  const [flashProps, setFlashProps] = useState({});

  const classes = useStyles();

  const { getFormattedMessage } = useLanguageProviderState();

  /**
   * Pager handler
   */
  const [page, setPage] = useState(0);
  const handlePage = (event, value) => {
    setPage(value);
  }

  const service = useGetAgentDirectoryService(page);

  // This squelches missing dependency warning in `useEffect` and prevents recursive depth exceeded error
  const memoizedGetFormattedMessage = React.useCallback(getFormattedMessage, [service.payload]);

  useEffect(() => {
    if (service.status === 'loaded') {
      if (service.payload.message) {
        setFlashProps({ message: memoizedGetFormattedMessage(service.payload.message), variant: 'error' });
      }
      else {
        setAgentList(service.payload);
      }
    }
  }, [service, memoizedGetFormattedMessage]);

  function ListItemLink(props) {
    return <ListItem className='list-item' button component="a" {...props} />;
  }

  return (
    <div className={classes.root}>
      <Grid container direction="column" justify="center" alignItems="center">
        <Grid id="agent-directory-table" item className={classes.grid}>
          <MaterialTable
            title={getFormattedMessage('Directory')}
            isLoading={service.status === 'loading'}
            columns={[
              {
                title: getFormattedMessage('Agent'),
                editable: 'never',
                render: (rowData) => {
                  return (
                    <ListItem className='agent-button' key={`Agents-${rowData.user_id}`}>
                      <ListItemLink href={`#agent/${rowData.user_id}`}>
                        <ListItemAvatar>
                          <Avatar className="avatar" alt={rowData.name} src={rowData.picture} />
                        </ListItemAvatar>
                        <ListItemText className="name-email" primary={rowData.name} secondary={rowData.email} />
                      </ListItemLink>
                    </ListItem>
                  );
                }
              },
            ]}
            data={agentList.results && agentList.results.users ? agentList.results.users : []}
            options={{
              search: false,
              paging: true,
              pageSize: 30,
              pageSizeOptions: [30],
              emptyRowsWhenPaging: false
            }}
            components={{
              Pagination: props => <TablePagination {...props}
                                                    page={agentList.results && agentList.results.total ? page : 0}
                                                    count={agentList.results && agentList.results.total ? agentList.results.total : 0}
                                                    onChangePage={handlePage} />
                }}
          />
        </Grid>
      </Grid>

      { flashProps.message ? <Flash message={getFormattedMessage(flashProps.message)} onClose={() => setFlashProps({})} variant={flashProps.variant} /> : '' }
      { flashProps.errors ? flashProps.errors.map(error => <Flash message={getFormattedMessage(error.message)}
                                                                  onClose={() => setFlashProps({})}
                                                                  variant={flashProps.variant}
                                                                  key={`error-${error.message}`} />) : '' }
    </div>
  );
};

export default AgentDirectory;

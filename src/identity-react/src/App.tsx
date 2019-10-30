// src/App.js
// See: https://auth0.com/docs/quickstart/spa/react/01-login
import React from 'react';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import NavBar from './components/NavBar';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import Profile from './components/Profile';
import ExternalApi from './components/ExternalApi';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import Typography from '@material-ui/core/Typography';
import { useAuth0 } from './react-auth0-wrapper';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
    },
  }),
);

function App() {
  const classes = useStyles();
  const { isAuthenticated, loginWithRedirect } = useAuth0();


  return (
    <div className="App">
           <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" className={classes.menuButton} color="inherit" aria-label="menu">
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" className={classes.title}>
            Identity
          </Typography>
          {!isAuthenticated && (
        <Button color="inherit" onClick={() => loginWithRedirect({})}>Log in</Button>
      )}
          {/* <Button color="inherit">Login</Button> */}
        </Toolbar>
      </AppBar>
      <BrowserRouter>
        <header>
          <NavBar />
        </header>
        <Switch>
          <Route path="/" exact />
          <PrivateRoute path="/profile" component={Profile} />
          <PrivateRoute path="/external-api" component={ExternalApi} />
        </Switch>
      </BrowserRouter>
    </div>
  );
}

export default App;

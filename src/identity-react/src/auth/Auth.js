/**
 * 2020-1-24
 *
 * Shamelessly stolen from https://kentcdodds.com/blog/authentication-in-react-applications
 */
import React from 'react';
import { Redirect } from 'react-router-dom';

export const AuthContext = React.createContext();

export function AuthProvider({children}) {

  const [state, setState] = React.useState({
    status: 'pending',
    error: null,
    agent: null,
  });


  React.useEffect(() => {
    console.log('login');
    const headers = new Headers();
 //   headers.append('Access-Control-Allow-Credentials', 'true');
//    headers.append('Access-Control-Allow-Origin', ['http://localhost:3001']);//'true');
    //fetch('/login', {method: 'GET', headers: headers, credentials: 'include', mode: 'no-cors' }).then(response => {
    
    //fetch('/login', {method: 'GET', headers: headers, credentials: 'include', mode: 'no-cors', redirect: 'follow' }).then(response => {
    fetch('/agent', {method: 'GET', headers: headers}).then(response => {
//       return response.json();
      return response.text();
    }).then(profile => {
      console.log('FETCH RESPONSE');
      console.log(profile);
      console.log(JSON.parse(profile).socialProfile.picture);
//      setState({status: 'success', error: null, agent: profile});
      setState({status: 'success', error: null, agent: profile ? JSON.parse(profile) : {} });
    }).catch(error => {
      console.log('FETCH ERROR', error);
      setState({status: 'error', error, agent: null});
    });
  }, []);

  function logout() {
    setState({status: 'pending', err: null, agent: null});
    window.location.href = '/logout';
  };

  return (
    <AuthContext.Provider value={{ ...state, logout: logout}}>
      {state.status === 'pending' ? (
        'Loading...'
      ) : state.status === 'error' ? (
        <div>
          Oh no
          <div>
            <pre>{state.error.message}</pre>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuthState() {
  const state = React.useContext(AuthContext)
  const isPending = state.status === 'pending';
  const isError = state.status === 'error';
  const isSuccess = state.status === 'success';
  const isAuthenticated = state.agent && isSuccess;
  return {
    ...state,
    isPending,
    isError,
    isSuccess,
    isAuthenticated,
  }
}


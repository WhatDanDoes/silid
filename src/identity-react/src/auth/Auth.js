/**
 * 2020-1-24
 *
 * Shamelessly stolen from https://kentcdodds.com/blog/authentication-in-react-applications
 */
import React from 'react';

export const AuthContext = React.createContext();

export function AuthProvider({children}) {

  const [state, setState] = React.useState({
    status: 'pending',
    error: null,
    agent: null,
  });

  React.useEffect(() => {
    const headers = new Headers();
    fetch('/agent', {method: 'GET', headers: headers}).then(response => {
      return response.text();
    }).then(profile => {
      setState({status: 'success', error: null, agent: profile ? JSON.parse(profile) : {} });
    }).catch(error => {
      setState({status: 'error', error, agent: null});
    });
  }, []);

  function logout() {
    setState({status: 'pending', err: null, agent: null});
    window.location.href = '/logout';
  };

  function updateAgent(a) {
    setState({...state, agent: a})
  };

  return (
    <AuthContext.Provider value={{ ...state, updateAgent: updateAgent, logout: logout}}>
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
  const state = React.useContext(AuthContext);
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

import { useState } from 'react';

const usePutTeamService = () => {
  const [service, setService] = useState({
    status: 'init',
  });

  const publishTeam = (team) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/team/${team.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(team),
          headers,
        }
      )
        .then(response => response.json())
        .then(response => {
          setService({ status: 'loaded', payload: response });
          resolve(response);
        })
        .catch(error => {
          setService({ status: 'error', error });
          reject(error);
        });
    });
  };

  return {
    service,
    publishTeam,
  };
};

export default usePutTeamService;

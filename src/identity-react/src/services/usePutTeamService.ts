import { useState } from 'react';
import { Service } from '../types/Service';
import { Team } from '../types/Team';

export type PutTeam = Pick<Team, 'name' | 'id'>;

const usePutTeamService = () => {
  const [service, setService] = useState<Service<PutTeam>>({
    status: 'init',
  });

  const publishTeam = (team: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Access-Control-Allow-Credentials', 'true');
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch('/team',
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

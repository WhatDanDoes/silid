import { useState } from 'react';
import { Service } from '../types/Service';
import { Team } from '../types/Team';

export type DeleteTeam = Pick<Team, 'id'>;

const useDeleteTeamService = () => {
  const [service, setService] = useState<Service<DeleteTeam>>({
    status: 'init',
  });

  const deleteTeam = (teamId: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Access-Control-Allow-Credentials', 'true');
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/team/${teamId}`,
        {
          method: 'DELETE',
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
    deleteTeam,
  };
};

export default useDeleteTeamService;

import { useState } from 'react';
import { Service } from '../types/Service';
import { Team } from '../types/Team';

export type PutTeamMember = Pick<any, 'id' | 'email'>;

const usePutTeamMemberService = () => {
  const [service, setService] = useState<Service<PutTeamMember>>({
    status: 'init',
  });

  const putTeamMember = (update: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Authorization', `Bearer ${localStorage.getItem('accessToken')}`);
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/team/${update.id}/agent`,
        {
          method: 'PUT',
          body: JSON.stringify(update),
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
    putTeamMember,
  };
};

export default usePutTeamMemberService;

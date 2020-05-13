import { useState } from 'react';
import { Service } from '../types/Service';

export type PutTeamMember = Pick<any, 'id' | 'email'>;

const usePutTeamMemberService = () => {
  const [service, setService] = useState<Service<PutTeamMember>>({
    status: 'init',
  });

  const putTeamMember = (teamId: any, data: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/team/${teamId}/agent`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
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

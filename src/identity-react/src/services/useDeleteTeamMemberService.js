import { useState } from 'react';
import { Service } from '../types/Service';
import { Agent } from '../types/Agent';

export type DeleteTeamMember = Pick<Agent, 'id'>;

const useDeleteTeamMemberService = (teamId: any) => {
  const [service, setService] = useState<Service<DeleteTeamMember>>({
    status: 'init',
  });

  const deleteTeamMember = (memberId: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/team/${teamId}/agent/${memberId}`,
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
    deleteTeamMember,
  };
};

export default useDeleteTeamMemberService;

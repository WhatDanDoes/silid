import { useState } from 'react';
import { Service } from '../types/Service';
import { Agent } from '../types/Agent';

export type DeleteMemberAgent = Pick<Agent, 'id'>;

const useDeleteMemberAgentService = (organizationId: any) => {
  const [service, setService] = useState<Service<DeleteMemberAgent>>({
    status: 'init',
  });

  const deleteMemberAgent = (memberId: any) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Authorization', `Bearer ${localStorage.getItem('accessToken')}`);
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/organization/${organizationId}/agent/${memberId}`,
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
    deleteMemberAgent,
  };
};

export default useDeleteMemberAgentService;

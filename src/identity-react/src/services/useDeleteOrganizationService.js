import { useState } from 'react';

const useDeleteOrganizationService = () => {
  const [service, setService] = useState({
    status: 'init',
  });

  const deleteOrganization = (id) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch(`/organization/${id}`,
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
    deleteOrganization,
  };
};

export default useDeleteOrganizationService;

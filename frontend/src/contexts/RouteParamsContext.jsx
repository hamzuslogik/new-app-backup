import React, { createContext, useContext } from 'react';

const RouteParamsContext = createContext(null);

export const RouteParamsProvider = ({ children, params, navigate }) => {
  return (
    <RouteParamsContext.Provider value={{ params, navigate }}>
      {children}
    </RouteParamsContext.Provider>
  );
};

export const useRouteParams = () => {
  return useContext(RouteParamsContext) || { params: {}, navigate: null };
};


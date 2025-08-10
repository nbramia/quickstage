import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Dashboard } from './routes/Dashboard';
import { Viewer } from './routes/Viewer';
import { Settings } from './routes/Settings';

const router = createBrowserRouter([
  { path: '/', element: <Dashboard /> },
  { path: '/app/s/:id', element: <Viewer /> },
  { path: '/app/settings', element: <Settings /> },
]);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);


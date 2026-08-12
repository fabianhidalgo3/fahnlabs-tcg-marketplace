export const environment = {
  production: true,
  // En Docker el frontend (nginx) proxya /api al backend → mismo origen, sin CORS.
  apiUrl: '/api',
};

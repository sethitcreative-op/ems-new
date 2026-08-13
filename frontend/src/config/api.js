const API_BASE = import.meta.env.PROD
  ? '/api'
  : 'http://localhost/ems-new/backend/api';

export default API_BASE;

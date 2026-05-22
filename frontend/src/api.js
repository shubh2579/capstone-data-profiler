import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getStatus  = ()       => api.get('/status')
export const runProfile = ()       => api.post('/profile')
export const runClean   = ()       => api.post('/clean')
export const runSQL     = (q)      => api.post('/sql',     { question: q })
export const runAnomaly = ()       => api.post('/anomaly')

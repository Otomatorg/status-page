import axios from 'axios'
import { config } from 'dotenv'

config()

const baseURL = process.env.API_ENDPOINT

export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

api.interceptors.response.use(
  function (response) {
    return response
  },

  async function (error) {
    const {
      response: { status },
    } = error

    if (status === 403) {
      throw new Error('Unauthorized')
    }
    return Promise.reject(error)
  },
)

export const setAxiosAuthorization = (token: string) => {
  api.defaults.headers.common['Authorization'] = token && token
}

import axios from 'axios'
import { LARK_DOMAIN } from '../config/env'

export const lark = axios.create({
  baseURL: `${LARK_DOMAIN}/open-apis`,
  headers: { 'Content-Type': 'application/json; charset=utf-8' }
})

export function withAuth(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    }
  }
}


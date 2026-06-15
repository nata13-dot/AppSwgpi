import { configureStore, createSlice } from '@reduxjs/toolkit'

const readSession = () => {
  try {
    const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage
    return {
      token: storage.getItem('auth_token'),
      user: JSON.parse(storage.getItem('auth_user') || 'null'),
      remember: storage === localStorage,
    }
  } catch {
    return { token: null, user: null, remember: false }
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { ...readSession(), status: 'idle' },
  reducers: {
    setCredentials(state, { payload }) {
      state.token = payload.token
      state.user = payload.user
      state.remember = Boolean(payload.remember)
      const storage = state.remember ? localStorage : sessionStorage
      const other = state.remember ? sessionStorage : localStorage
      other.removeItem('auth_token')
      other.removeItem('auth_user')
      storage.setItem('auth_token', payload.token)
      storage.setItem('auth_user', JSON.stringify(payload.user))
    },
    setUser(state, { payload }) {
      state.user = payload
      const storage = state.remember ? localStorage : sessionStorage
      storage.setItem('auth_user', JSON.stringify(payload))
    },
    clearCredentials(state) {
      state.token = null
      state.user = null
      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem('auth_token')
        storage.removeItem('auth_user')
      }
    },
  },
})

export const { setCredentials, setUser, clearCredentials } = authSlice.actions
export const store = configureStore({ reducer: { auth: authSlice.reducer } })

/** Redux store configuration */

import { configureStore, createSlice } from '@reduxjs/toolkit'

// Initial dummy slice for asset state
const assetsSlice = createSlice({
  name: 'assets',
  initialState: {
    selected: null as string | null,
    filters: {},
  },
  reducers: {
    selectAsset: (state, action) => {
      state.selected = action.payload
    },
    setFilters: (state, action) => {
      state.filters = action.payload
    },
  },
})

const store = configureStore({
  reducer: {
    assets: assetsSlice.reducer,
  },
})

export const { selectAsset, setFilters } = assetsSlice.actions
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store

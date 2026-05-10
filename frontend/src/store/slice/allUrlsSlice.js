import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  urls: [],
};

const urlsSlice = createSlice({
  name: 'urls',
  initialState,
  reducers: {
    setUrl: (state, action) => {
      state.urls = action.payload;
    },
    addUrl: (state, action) => {
      state.urls.push(action.payload);
    },
    removeUrl: (state, action) => {
      state.urls = state.urls.filter((url) => url._id !== action.payload);
    },
  },
});


export const { addUrl, removeUrl, setUrl } = urlsSlice.actions;
export default urlsSlice.reducer;
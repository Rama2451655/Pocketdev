// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import editorReducer from './editorSlice';
import projectReducer from './projectSlice';
import terminalReducer from './terminalSlice';
import settingsReducer from './settingsSlice';
import gitReducer from './gitSlice';
import devServerReducer from './devServerSlice';

export const store = configureStore({
  reducer: {
    editor: editorReducer,
    project: projectReducer,
    terminal: terminalReducer,
    settings: settingsReducer,
    git: gitReducer,
    devServer: devServerReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'editor/setFileContent',
          'project/setFileTree',
          'devServer/updateDevServer',
        ],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

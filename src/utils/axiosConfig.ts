/* eslint-disable no-underscore-dangle */
import axios from "axios";
import { setCredentials } from "../stores/auth/authSlice";

let store: any;

// Recommended approach to avoid circular import dependency error
export const injectStore = (_store: any) => {
  store = _store;
};

export const apiErrorResponse = (error: any) => {
  if (error.response) {
    console.log(error.response.data);
    console.log(error.response.status);
    console.log(error.response.headers);
  } else if (error.request) {
    console.log(error.request);
  } else {
    console.log("Error", error.message);
  }
};

const instance = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true,
});

instance.interceptors.request.use(
  (config: any) => {
    const { accessToken } = store.getState().auth;

    if (accessToken) {
      config.headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      };
    }

    return config;
  },
  (err: any) => Promise.reject(err)
);

let calledOnce = false;

instance.interceptors.response.use(
  (response: any) => {
    return response;
  },
  async (error: any) => {
    const originalRequest = error.config;

    if (error.response !== null) {
      if (error.response.status === 403 && !originalRequest._retry) {
        if (!calledOnce) {
          calledOnce = true;

          try {
            const refreshData = await instance.get("/refresh_token/verify");

            if (refreshData) {
              const { user } = store.getState().auth;
              axios.defaults.headers.common.Authorization = `Bearer ${refreshData.data.access_token}`;

              store.dispatch(
                setCredentials({
                  user,
                  access_token: refreshData.data.access_token,
                })
              );

              return instance(originalRequest);
            }
          } catch (error: any) {
            if (error.response && error.response.data) {
              return Promise.reject(error.response.data);
            }

            return Promise.reject(error);
          } finally {
            originalRequest._retry = true;
            calledOnce = false;
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export default instance;

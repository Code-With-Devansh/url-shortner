import axiosInstance from "../utils/axiosInstance";

// ── Overall (all of the user's URLs) ──

export const getOverallSummary = async (range = "30d") => {
  const { data } = await axiosInstance.get(`/api/analytics/summary`, {
    params: { range },
  });
  return data.data;
};

export const getOverallTimeseries = async (range = "30d") => {
  const { data } = await axiosInstance.get(`/api/analytics/timeseries`, {
    params: { range },
  });
  return data.data;
};

export const getOverallBreakdown = async (by, range = "30d") => {
  const { data } = await axiosInstance.get(`/api/analytics/breakdown`, {
    params: { by, range },
  });
  return data.data;
};

export const getLeaderboard = async (range = "30d", limit = 10) => {
  const { data } = await axiosInstance.get(`/api/analytics/leaderboard`, {
    params: { range, limit },
  });
  return data.data;
};

// ── Per-URL ──

export const getUrlSummary = async (id, range = "30d") => {
  const { data } = await axiosInstance.get(`/api/analytics/summary/${id}`, {
    params: { range },
  });
  return data.data;
};

export const getUrlTimeseries = async (id, range = "30d") => {
  const { data } = await axiosInstance.get(
    `/api/analytics/timeseries/${id}`,
    { params: { range } },
  );
  return data.data;
};

export const getUrlBreakdown = async (id, by, range = "30d") => {
  const { data } = await axiosInstance.get(`/api/analytics/breakdown/${id}`, {
    params: { by, range },
  });
  return data.data;
};

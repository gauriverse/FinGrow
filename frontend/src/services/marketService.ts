import axios from "axios";

const API = "http://127.0.0.1:8000/market";

export const getNifty = async () => {
  const res = await axios.get(`${API}/nifty`);
  return res.data;
};

export const getSensex = async () => {
  const res = await axios.get(`${API}/sensex`);
  return res.data;
};

export const getStock = async (symbol: string) => {
  const res = await axios.get(`${API}/stock/${symbol}`);
  return res.data;
};
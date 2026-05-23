const clients = new Map(); 

export const addClient = (userId, res) => clients.set(userId, res);
export const removeClient = (userId) => clients.delete(userId);

export const notifyClient = (userId, event, data) => {
  const res = clients.get(userId);
  if (!res) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};
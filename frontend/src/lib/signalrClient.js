import * as signalR from '@microsoft/signalr';

let connection = null;

export async function createOrGetConnection(token) {
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl((import.meta.env.VITE_API_BASE_URL || 'https://localhost:7065') + '/hubs/orbit', {
      accessTokenFactory: () => token || localStorage.getItem('token') || ''
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  try {
    await connection.start();
  } catch (err) {
    console.error('SignalR connection error:', err);
  }

  return connection;
}

export function joinProjectGroup(conn, projectId) {
  if (!conn) return;
  try {
    conn.invoke('JoinProject', projectId).catch(err => console.error(err));
  } catch (e) {
    console.error(e);
  }
}

export function leaveProjectGroup(conn, projectId) {
  if (!conn) return;
  try {
    conn.invoke('LeaveProject', projectId).catch(err => console.error(err));
  } catch (e) {
    console.error(e);
  }
}

export function onEvent(conn, eventName, handler) {
  if (!conn) return;
  conn.on(eventName, handler);
}

export function offEvent(conn, eventName, handler) {
  if (!conn) return;
  conn.off(eventName, handler);
}

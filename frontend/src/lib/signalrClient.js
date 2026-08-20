import * as signalR from '@microsoft/signalr';

let connection = null;

/**
 * Initializes or retrieves an active singleton SignalR HubConnection to `/hubs/orbit`.
 * Automatically injects the JWT authorization token and enables automatic reconnection.
 * @param {string} [token] - Optional explicit JWT token. Falls back to localStorage 'token'.
 * @returns {Promise<signalR.HubConnection>} Active HubConnection instance.
 */
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

/**
 * Invokes 'JoinProject' on the Hub to subscribe the client to live project room events.
 * @param {signalR.HubConnection} conn - The active connection.
 * @param {number|string} projectId - The target project ID.
 */
export function joinProjectGroup(conn, projectId) {
  if (!conn) return;
  try {
    conn.invoke('JoinProject', projectId).catch(err => console.error(err));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Invokes 'LeaveProject' on the Hub to unsubscribe from project room events.
 * @param {signalR.HubConnection} conn - The active connection.
 * @param {number|string} projectId - The target project ID.
 */
export function leaveProjectGroup(conn, projectId) {
  if (!conn) return;
  try {
    conn.invoke('LeaveProject', projectId).catch(err => console.error(err));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Registers an event listener callback for a specific SignalR server broadcast.
 * @param {signalR.HubConnection} conn - The active connection.
 * @param {string} eventName - Name of the hub event (e.g. 'TaskUpdated', 'CommentAdded').
 * @param {Function} handler - The callback function to execute on message receipt.
 */
export function onEvent(conn, eventName, handler) {
  if (!conn) return;
  conn.on(eventName, handler);
}

/**
 * Unregisters an event listener callback from a SignalR server broadcast.
 * @param {signalR.HubConnection} conn - The active connection.
 * @param {string} eventName - Name of the hub event.
 * @param {Function} handler - The callback function to remove.
 */
export function offEvent(conn, eventName, handler) {
  if (!conn) return;
  conn.off(eventName, handler);
}

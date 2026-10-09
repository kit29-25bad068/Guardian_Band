class SocketService {
  constructor() {
    this.io = null;
  }

  init(ioInstance) {
    this.io = ioInstance;

    this.io.on('connection', (socket) => {
      console.log(`[SocketService] Client connected: ${socket.id} (transport: ${socket.conn.transport.name})`);

      socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`[SocketService] Client ${socket.id} joined room: ${room}`);
      });

      // Bi-directional Central Dashboard -> Device Simulator Commands
      socket.on('dashboard:command', (payload) => {
        console.log(`[SocketService] 🎛️ Received dashboard:command for device ${payload?.deviceId}:`, payload?.command);
        if (payload?.deviceId && payload?.command) {
          this.broadcastDeviceCommand(payload.deviceId, payload.command, payload.params);
        }
      });

      // Simulator -> Backend telemetry broadcast
      socket.on('device:state_update', (device) => {
        if (device && device.deviceId) {
          this.broadcastDeviceStatus(device);
        }
      });

      socket.on('disconnect', (reason) => {
        console.log(`[SocketService] Client disconnected: ${socket.id} (${reason})`);
      });
    });

    console.log('[SocketService] Real-time bi-directional event bus initialized.');
  }

  broadcastDeviceCommand(deviceId, command, params = {}) {
    if (!this.io) return;
    const payload = {
      deviceId,
      command,
      params,
      timestamp: new Date().toISOString()
    };
    console.log(`[SocketService] 📡 Dispatched command to device ${deviceId}: [${command}]`);
    this.io.emit('device:command', payload);
  }

  broadcastNewEmergency(emergency, user = null, device = null) {
    if (!this.io) return;
    const payload = {
      emergency,
      user,
      device,
      timestamp: new Date().toISOString()
    };
    console.log(`[SocketService] 🚨 Broadcasting NEW EMERGENCY: ${emergency.emergencyId} to all control rooms.`);
    this.io.emit('emergency:new', payload);
    this.io.to('police').emit('police:emergency:alert', payload);
  }

  broadcastLocationUpdate(emergencyId, locationPoint) {
    if (!this.io) return;
    this.io.emit('emergency:location_update', {
      emergencyId,
      location: locationPoint,
      timestamp: new Date().toISOString()
    });
  }

  broadcastEmergencyUpdated(emergency) {
    if (!this.io) return;
    this.io.emit('emergency:status_change', {
      emergency,
      timestamp: new Date().toISOString()
    });
  }

  broadcastDeviceStatus(device) {
    if (!this.io) return;
    this.io.emit('device:telemetry', {
      device,
      timestamp: new Date().toISOString()
    });
  }

  broadcastSOSCancelled(cancellation) {
    if (!this.io) return;
    this.io.emit('emergency:cancelled', {
      cancellation,
      timestamp: new Date().toISOString()
    });
  }

  broadcastSMSDispatched(smsRecord) {
    if (!this.io) return;
    this.io.emit('sms:dispatched', {
      sms: smsRecord,
      timestamp: new Date().toISOString()
    });
  }
}

export const socketService = new SocketService();

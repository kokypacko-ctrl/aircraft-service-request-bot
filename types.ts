
export enum RequestStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
}

export enum ServiceType {
  Connect = 'CONNECT',
  Disconnect = 'DISCONNECT',
  Replace = 'REPLACE',
}

export interface ServiceRequest {
  id: string;
  staffName: string;
  staffNumber: string;
  aircraftBay: string;
  flightNumber: string;
  requestTime: Date;
  completionTime?: Date;
  status: RequestStatus;
  serviceType: ServiceType;
  aircraftEta: string;
  deliveryStaffName?: string;
  deliveryStaffNumber?: string;
}

export interface NotificationMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
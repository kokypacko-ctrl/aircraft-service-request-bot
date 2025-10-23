import { ServiceRequest } from './types';

// The base path for all API requests.
// This will be a relative path so it works in both development and production on Vercel.
const API_BASE_PATH = '/api';

// A helper function to process the API response.
// It handles JSON parsing and throws an error for non-OK responses.
const processResponse = async (response: Response) => {
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    // Handle cases where there might not be a JSON body (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    }
    return {}; // Return empty object for non-json responses
};

// A helper to transform API responses (snake_case) to frontend objects (camelCase).
// It also converts date strings into Date objects.
const transformRequest = (request: any): ServiceRequest => ({
    id: request.id,
    staffName: request.staff_name,
    staffNumber: request.staff_number,
    aircraftBay: request.aircraft_bay,
    flightNumber: request.flight_number,
    requestTime: new Date(request.request_time),
    completionTime: request.completion_time ? new Date(request.completion_time) : undefined,
    status: request.status,
    serviceType: request.service_type,
    aircraftEta: request.aircraft_eta,
    deliveryStaffName: request.delivery_staff_name,
    deliveryStaffNumber: request.delivery_staff_number,
});


// --- API Functions ---

export const getRequests = async (): Promise<ServiceRequest[]> => {
    console.log('API: Fetching all requests...');
    const response = await fetch(`${API_BASE_PATH}/requests`);
    const data = await processResponse(response);
    // Transform each request object from snake_case to camelCase.
    return data.map(transformRequest);
};

export const createRequest = async (requestData: Omit<ServiceRequest, 'id' | 'requestTime' | 'status'>): Promise<ServiceRequest> => {
    console.log('API: Creating new request...');
    const response = await fetch(`${API_BASE_PATH}/requests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // Frontend uses camelCase, which the backend expects for this endpoint
        body: JSON.stringify({
            staffName: requestData.staffName,
            staffNumber: requestData.staffNumber,
            aircraftBay: requestData.aircraftBay,
            flightNumber: requestData.flightNumber,
            serviceType: requestData.serviceType,
            aircraftEta: requestData.aircraftEta,
        }),
    });
    const newRequest = await processResponse(response);
    // Transform the snake_case response from the backend to camelCase for the frontend
    return transformRequest(newRequest);
};

export const updateRequest = async (id: string, updates: Partial<Omit<ServiceRequest, 'id'>>): Promise<ServiceRequest> => {
    console.log(`API: Updating request ${id}...`);
    const response = await fetch(`${API_BASE_PATH}/requests/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        // Frontend uses camelCase, which the backend expects for this endpoint
        body: JSON.stringify(updates),
    });
    const updatedRequest = await processResponse(response);
    // Transform the snake_case response from the backend to camelCase for the frontend
    return transformRequest(updatedRequest);
};

export const deleteRequest = async (id: string): Promise<{ success: true }> => {
    console.log(`API: Deleting request ${id}...`);
    const response = await fetch(`${API_BASE_PATH}/requests/${id}`, {
        method: 'DELETE',
    });
    await processResponse(response);
    console.log(`API: Request ${id} deleted.`);
    return { success: true };
};
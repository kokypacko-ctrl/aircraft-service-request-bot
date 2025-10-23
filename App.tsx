import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ServiceRequest, RequestStatus, ServiceType, NotificationMessage } from './types';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import Header from './components/Header';
import ConfirmationDialog from './components/ConfirmationDialog';
import LoginPage from './components/LoginPage';
import DeliveryCompletionDialog from './components/DeliveryCompletionDialog';
import RoleSelectionPage from './components/RoleSelectionPage';
import Notification from './components/Notification';
import * as api from './api';

const App: React.FC = () => {
  const [role, setRole] = useState<'REQUEST' | 'DELIVERY' | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme;
      }
    }
    // Default to dark theme if nothing is set or on server
    return 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);


  const handleRoleSelect = (selectedRole: 'REQUEST' | 'DELIVERY') => {
    setRole(selectedRole);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setRole(null);
    setIsAuthenticated(false);
  };

  if (!role) {
    return <RoleSelectionPage onSelectRole={handleRoleSelect} />;
  }

  if (!isAuthenticated) {
    return <LoginPage role={role} onLoginSuccess={handleLoginSuccess} />;
  }

  return <MainApplication role={role} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />;
};


const MainApplication: React.FC<{ role: 'REQUEST' | 'DELIVERY', onLogout: () => void, theme: 'dark' | 'light', onToggleTheme: () => void }> = ({ role, onLogout, theme, onToggleTheme }) => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedRequests = await api.getRequests();
      setRequests(fetchedRequests);
    } catch (err) {
      setError("Failed to load service requests. Please try again later.");
      console.error(err);
      addNotification("Failed to load service requests from the server.", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>(role === 'DELIVERY' ? RequestStatus.Pending : 'ALL');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingComplete, setConfirmingComplete] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [completingDelivery, setCompletingDelivery] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  const addNotification = useCallback((message: string, type: NotificationMessage['type']) => {
    const id = `notif-${Date.now()}`;
    setNotifications(current => [...current, { id, message, type }]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(current => current.filter(n => n.id !== id));
  }, []);

  const addRequest = async (request: Omit<ServiceRequest, 'id' | 'requestTime' | 'status'>) => {
    try {
      const newRequest = await api.createRequest(request);
      setRequests(prevRequests => [newRequest, ...prevRequests]);
      addNotification('Service request created successfully.', 'success');
    } catch (err) {
      addNotification('Failed to create service request.', 'error');
      console.error(err);
    }
  };

  const handleInitiateComplete = (id: string) => {
    setConfirmingComplete(id);
  };

  const handleConfirmComplete = async () => {
    if (!confirmingComplete) return;
    try {
        const updates = { status: RequestStatus.Completed, completionTime: new Date() };
        const updatedRequest = await api.updateRequest(confirmingComplete, updates);
        setRequests(prevRequests =>
            prevRequests.map(req =>
                req.id === confirmingComplete ? updatedRequest : req
            )
        );
        setConfirmingComplete(null);
        addNotification('Request marked as complete.', 'info');
    } catch (err) {
        addNotification('Failed to mark request as complete.', 'error');
        console.error(err);
    }
  };
  
  const handleCancelComplete = () => {
    setConfirmingComplete(null);
  };

  const handleConfirmCompleteDelivery = async (deliveryStaffName: string, deliveryStaffNumber: string, completionTimeStr: string) => {
    if (!completingDelivery) return;
    try {
      const reqToUpdate = requests.find(r => r.id === completingDelivery);
      if (!reqToUpdate) {
        throw new Error(`Request with ID ${completingDelivery} not found in state.`);
      }
      const [hours, minutes] = completionTimeStr.split(':').map(Number);
      const completionDate = new Date(reqToUpdate.requestTime);
      completionDate.setHours(hours, minutes, 0, 0);

      const updates = {
        status: RequestStatus.Completed,
        completionTime: completionDate,
        deliveryStaffName,
        deliveryStaffNumber,
      };
      
      const updatedRequest = await api.updateRequest(completingDelivery, updates);
      
      setRequests(prevRequests =>
        prevRequests.map(req =>
          req.id === completingDelivery ? updatedRequest : req
        )
      );
      setCompletingDelivery(null);
      addNotification('Task completed successfully.', 'success');
    } catch (err) {
      addNotification('Failed to complete task.', 'error');
      console.error(err);
    }
  };

  const handleInitiateDelete = (id: string) => {
    setConfirmingDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmingDelete) return;
    try {
      await api.deleteRequest(confirmingDelete);
      setRequests(prevRequests => prevRequests.filter(req => req.id !== confirmingDelete));
      setConfirmingDelete(null);
      addNotification('Request has been deleted.', 'info');
    } catch(err) {
      addNotification('Failed to delete request.', 'error');
      console.error(err);
    }
  };

  const handleCancelDelete = () => {
    setConfirmingDelete(null);
  };


  const downloadAsExcel = () => {
    const headers = [
      'Request ID',
      'Status',
      'Service Type',
      'Requester Name',
      'Requester Number',
      'Aircraft Bay',
      'Flight Number',
      'ETA',
      'Request Time',
      'Completion Time',
      'Delivery Staff Name',
      'Delivery Staff Number',
    ];

    const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };

    const formatDateTimeForCSV = (date?: Date) => {
      if (!date) return 'N/A';
      return `"${date.toLocaleString('default', dateTimeFormatOptions)}"`;
    };

    const rows = requests.map(req =>
      [
        req.id,
        req.status,
        req.serviceType,
        req.staffName,
        req.staffNumber,
        req.aircraftBay,
        req.flightNumber,
        req.aircraftEta,
        formatDateTimeForCSV(req.requestTime),
        formatDateTimeForCSV(req.completionTime),
        req.deliveryStaffName || 'N/A',
        req.deliveryStaffNumber || 'N/A',
      ].join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-t;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'service_requests.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
        if (a.status === RequestStatus.Pending && b.status === RequestStatus.Completed) {
            return -1; // a (pending) comes first
        }
        if (a.status === RequestStatus.Completed && b.status === RequestStatus.Pending) {
            return 1; // b (pending) comes first
        }
        // if statuses are same, sort by newest first
        return b.requestTime.getTime() - a.requestTime.getTime();
    });
  }, [requests]);

  const pendingCount = useMemo(() => requests.filter(req => req.status === RequestStatus.Pending).length, [requests]);

  const filteredRequests = useMemo(() => {
    return sortedRequests
      .filter(req => statusFilter === 'ALL' || req.status === statusFilter)
      .filter(req => serviceTypeFilter === 'ALL' || req.serviceType === serviceTypeFilter)
      .filter(req => {
        if (!dateFilter) return true;
        // 'en-CA' locale formats as YYYY-MM-DD, which matches the date input value format
        return req.requestTime.toLocaleDateString('en-CA') === dateFilter;
      })
      .filter(req => {
        if (!searchTerm.trim()) return true;
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        return (
          req.flightNumber.toLowerCase().includes(lowercasedSearchTerm) ||
          req.aircraftBay.toLowerCase().includes(lowercasedSearchTerm) ||
          req.staffName.toLowerCase().includes(lowercasedSearchTerm)
        );
      });
  }, [sortedRequests, statusFilter, serviceTypeFilter, dateFilter, searchTerm]);
  
  const filteredDeliveryRequests = useMemo(() => {
    return sortedRequests.filter(req => statusFilter === 'ALL' || req.status === statusFilter);
  }, [sortedRequests, statusFilter]);

  const serviceTypes: (ServiceType | 'ALL')[] = ['ALL', ...Object.values(ServiceType)];
  const statusTypes: (RequestStatus | 'ALL')[] = ['ALL', ...Object.values(RequestStatus)];

  const deliveryViewTitle =
    statusFilter === RequestStatus.Pending
      ? 'Pending Service Tasks'
      : statusFilter === RequestStatus.Completed
      ? 'Completed Service Tasks'
      : 'All Service Tasks';

  const StatusFilterButtons = () => (
    <div className="flex items-center flex-wrap gap-2">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Filter by status:</span>
      {statusTypes.map(status => (
        <button
          key={status}
          onClick={() => setStatusFilter(status)}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-200 capitalize focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-sky-500 ${
            statusFilter === status
              ? 'bg-sky-500 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
          }`}
        >
          {status.toLowerCase()}
        </button>
      ))}
       {statusFilter !== 'ALL' && (
        <button
          onClick={() => setStatusFilter('ALL')}
          className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors duration-200 flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-sky-500"
          aria-label="Clear status filter"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );

  const RequestListPanel: React.FC<{ requestsToShow: ServiceRequest[] }> = ({ requestsToShow }) => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
        </div>
      );
    }
  
    if (error) {
      return (
        <div className="text-center py-12 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-red-800 dark:text-red-200">API Error</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      );
    }
  
    return (
      <RequestList
        requests={requestsToShow}
        onComplete={role === 'DELIVERY' ? setCompletingDelivery : handleInitiateComplete}
        onDelete={handleInitiateDelete}
        isDeliveryView={role === 'DELIVERY'}
      />
    );
  };

  return (
    <>
      <div
        aria-live="assertive"
        className="fixed inset-0 flex flex-col items-end px-4 py-6 pointer-events-none sm:p-6 space-y-4 z-50"
      >
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            notification={notification}
            onDismiss={removeNotification}
          />
        ))}
      </div>
      <div className="min-h-screen font-sans">
        <Header onDownload={downloadAsExcel} onLogout={onLogout} role={role} theme={theme} onToggleTheme={onToggleTheme} pendingCount={pendingCount} />
        {role === 'REQUEST' ? (
        <main className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <RequestForm onSubmit={addRequest} />
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6">
               <h2 className="text-xl font-bold text-sky-600 dark:text-sky-400 mb-6 border-b border-slate-200 dark:border-slate-700 pb-3">
                All Service Requests
              </h2>
              <div className="flex flex-col gap-4 mb-4">
                 <div>
                    <label htmlFor="search" className="sr-only">Search</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="search"
                        placeholder="Search by flight, bay, or staff..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md py-2 pl-10 pr-10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition placeholder-slate-400 dark:placeholder-slate-400"
                      />
                      {searchTerm && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <button
                            onClick={() => setSearchTerm('')}
                            className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 rounded-full"
                            aria-label="Clear search"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                <StatusFilterButtons />
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Filter by type:</span>
                  {serviceTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setServiceTypeFilter(type)}
                      className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-200 capitalize focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-sky-500 ${
                        serviceTypeFilter === type
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      {type.toLowerCase()}
                    </button>
                  ))}
                  {serviceTypeFilter !== 'ALL' && (
                    <button
                      onClick={() => setServiceTypeFilter('ALL')}
                      className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors duration-200 flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-sky-500"
                      aria-label="Clear type filter"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center flex-wrap gap-2">
                    <label htmlFor="date-filter" className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Filter by date:</label>
                    <input
                        type="date"
                        id="date-filter"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md py-1 px-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition placeholder-slate-500 dark:placeholder-slate-400"
                    />
                    {dateFilter && (
                         <button
                            onClick={() => setDateFilter('')}
                            className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors duration-200 flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-sky-500"
                            aria-label="Clear date filter"
                            >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear
                        </button>
                    )}
                </div>
              </div>

              <div id="request-panel">
                <RequestListPanel requestsToShow={filteredRequests} />
              </div>
            </div>
          </div>
        </main>
        ) : (
        <main className="container mx-auto p-4 md:p-8">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6">
                <h2 className="text-xl font-bold text-sky-600 dark:text-sky-400 mb-6 border-b border-slate-200 dark:border-slate-700 pb-3 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <title>{deliveryViewTitle}</title>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {deliveryViewTitle}
                </h2>
                <div className="mb-4">
                  <StatusFilterButtons />
                </div>
                <RequestListPanel requestsToShow={filteredDeliveryRequests} />
            </div>
        </main>
        )}
      </div>
      {confirmingComplete && (
         <ConfirmationDialog
            message="Are you sure you want to mark this request as completed?"
            onConfirm={handleConfirmComplete}
            onCancel={handleCancelComplete}
        />
      )}
      {confirmingDelete && (
         <ConfirmationDialog
            message="Are you sure you want to permanently delete this request?"
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
        />
      )}
      {completingDelivery && (
          <DeliveryCompletionDialog 
            onConfirm={handleConfirmCompleteDelivery}
            onCancel={() => setCompletingDelivery(null)}
          />
      )}
    </>
  );
};

export default App;
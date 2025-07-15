import React from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { useNotification } from './NotificationContext';

function ToastNotification() {
    const { notification } = useNotification();

    if (!notification) {
        return null;
    }

    // Determine the style and icon based on the notification type
    const isSuccess = notification.type === 'success';
    const bgColorClass = isSuccess ? 'text-bg-success' : 'text-bg-danger';
    const iconClass = isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';

    return (
        // This container uses Bootstrap classes to position the toast
        <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1050 }}>
            {/* This is the toast itself, with dynamic background color and your custom styling */}
            <div className={`toast show ${bgColorClass} rounded-lg shadow-lg`} role="alert" aria-live="assertive" aria-atomic="true">
                <div className="toast-body d-flex align-items-center">
                    {/* The dynamic icon */}
                    <i className={`bi ${iconClass} me-2 fs-5`}></i>
                    {/* The message from anywhere in your app */}
                    {notification.message}
                </div>
            </div>
        </div>
    );
}

export default ToastNotification;
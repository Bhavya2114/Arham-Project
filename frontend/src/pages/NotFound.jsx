import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="text-center">
        <h1 className="text-9xl font-extrabold text-green-600">404</h1>
        <p className="text-2xl font-bold text-gray-800 mt-4">Page Not Found</p>
        <p className="text-gray-500 mt-2">The page you are looking for does not exist or has been moved.</p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg shadow transition-colors duration-200"
          >
            Go back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

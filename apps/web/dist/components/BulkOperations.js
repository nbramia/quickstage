import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { api } from '../api';
export default function BulkOperations({ selectedSnapshots, projects, onClearSelection, onRefresh }) {
    const [isLoading, setIsLoading] = useState(false);
    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    if (selectedSnapshots.size === 0)
        return null;
    const handleBulkExtend = async () => {
        setIsLoading(true);
        try {
            const promises = Array.from(selectedSnapshots).map(id => api.post(`/api/snapshots/${id}/extend`));
            await Promise.all(promises);
            onRefresh();
            onClearSelection();
        }
        catch (error) {
            console.error('Failed to extend snapshots:', error);
            alert('Some snapshots could not be extended');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleBulkMove = async () => {
        if (!selectedProjectId)
            return;
        setIsLoading(true);
        try {
            const promises = Array.from(selectedSnapshots).map(id => api.put(`/api/snapshots/${id}`, {
                projectId: selectedProjectId === 'none' ? null : selectedProjectId
            }));
            await Promise.all(promises);
            onRefresh();
            onClearSelection();
            setShowMoveDialog(false);
        }
        catch (error) {
            console.error('Failed to move snapshots:', error);
            alert('Some snapshots could not be moved');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleBulkDelete = async () => {
        const count = selectedSnapshots.size;
        if (!confirm(`Are you sure you want to delete ${count} snapshot${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
            return;
        }
        setIsLoading(true);
        try {
            const promises = Array.from(selectedSnapshots).map(id => api.delete(`/api/snapshots/${id}`));
            await Promise.all(promises);
            onRefresh();
            onClearSelection();
        }
        catch (error) {
            console.error('Failed to delete snapshots:', error);
            alert('Some snapshots could not be deleted');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-lg border border-gray-200 p-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("span", { className: "text-sm text-gray-700", children: [selectedSnapshots.size, " snapshot", selectedSnapshots.size !== 1 ? 's' : '', " selected"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setShowMoveDialog(true), disabled: isLoading, className: "px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50", children: "Move to Project" }), _jsx("button", { onClick: handleBulkExtend, disabled: isLoading, className: "px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50", children: "Extend Expiry" }), _jsx("button", { onClick: handleBulkDelete, disabled: isLoading, className: "px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50", children: "Delete" }), _jsx("button", { onClick: onClearSelection, className: "px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300", children: "Cancel" })] })] }), isLoading && (_jsxs("div", { className: "mt-2 flex items-center text-sm text-gray-600", children: [_jsx("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" }), "Processing..."] }))] }) }), showMoveDialog && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Move to Project" }), _jsxs("p", { className: "text-sm text-gray-600 mb-4", children: ["Move ", selectedSnapshots.size, " snapshot", selectedSnapshots.size !== 1 ? 's' : '', " to:"] }), _jsxs("select", { value: selectedProjectId, onChange: (e) => setSelectedProjectId(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4", children: [_jsx("option", { value: "", children: "Select project..." }), _jsx("option", { value: "none", children: "No project (root)" }), projects
                                    .filter(p => !p.isArchived)
                                    .map(project => (_jsx("option", { value: project.id, children: project.name }, project.id)))] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleBulkMove, disabled: !selectedProjectId || isLoading, className: "flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50", children: isLoading ? 'Moving...' : 'Move' }), _jsx("button", { onClick: () => {
                                        setShowMoveDialog(false);
                                        setSelectedProjectId('');
                                    }, className: "flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300", children: "Cancel" })] })] }) }))] }));
}

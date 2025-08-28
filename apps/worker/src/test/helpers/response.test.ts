import { describe, it, expect, vi } from 'vitest';
import {
  jsonError,
  jsonSuccess,
  jsonNotFound,
  jsonUnauthorized,
  jsonForbidden,
  jsonServerError
} from '../../helpers/response';
import { createMockContext } from '../mocks/context';

describe('Response Helpers', () => {
  describe('jsonError', () => {
    it('should return error response with default status 400', () => {
      const mockContext = createMockContext();
      const result = jsonError(mockContext, 'Test error');
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Test error' },
        400
      );
    });

    it('should return error response with custom status', () => {
      const mockContext = createMockContext();
      const result = jsonError(mockContext, 'Server error', 500);
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Server error' },
        500
      );
    });

    it('should include additional fields in error response', () => {
      const mockContext = createMockContext();
      const result = jsonError(mockContext, 'Validation error', 422, { 
        field: 'email',
        code: 'INVALID_FORMAT'
      });
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { 
          error: 'Validation error',
          field: 'email',
          code: 'INVALID_FORMAT'
        },
        422
      );
    });
  });

  describe('jsonSuccess', () => {
    it('should return success response with default status 200', () => {
      const mockContext = createMockContext();
      const data = { user: { id: '123', name: 'Test' } };
      const result = jsonSuccess(mockContext, data);
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { success: true, user: { id: '123', name: 'Test' } },
        200
      );
    });

    it('should return success response with custom status', () => {
      const mockContext = createMockContext();
      const data = { message: 'Created successfully' };
      const result = jsonSuccess(mockContext, data, 201);
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { success: true, message: 'Created successfully' },
        201
      );
    });
  });

  describe('jsonNotFound', () => {
    it('should return 404 with default resource message', () => {
      const mockContext = createMockContext();
      const result = jsonNotFound(mockContext);
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Resource not found' },
        404
      );
    });

    it('should return 404 with custom resource message', () => {
      const mockContext = createMockContext();
      const result = jsonNotFound(mockContext, 'User');
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'User not found' },
        404
      );
    });
  });

  describe('jsonUnauthorized', () => {
    it('should return 401 with default message', () => {
      const mockContext = createMockContext();
      const result = jsonUnauthorized(mockContext);
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'unauthorized', message: 'Unauthorized' },
        401
      );
    });

    it('should return 401 with custom message', () => {
      const mockContext = createMockContext();
      const result = jsonUnauthorized(mockContext, 'Please log in to continue');
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'unauthorized', message: 'Please log in to continue' },
        401
      );
    });
  });

  describe('jsonForbidden', () => {
    it('should return 403 with default message', () => {
      const mockContext = createMockContext();
      const result = jsonForbidden(mockContext);
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'forbidden', message: 'Forbidden' },
        403
      );
    });

    it('should return 403 with custom message', () => {
      const mockContext = createMockContext();
      const result = jsonForbidden(mockContext, 'Admin access required');
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'forbidden', message: 'Admin access required' },
        403
      );
    });
  });

  describe('jsonServerError', () => {
    it('should return 500 with default message', () => {
      const mockContext = createMockContext();
      const result = jsonServerError(mockContext);
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'server_error', message: 'Internal server error' },
        500
      );
    });

    it('should return 500 with custom message', () => {
      const mockContext = createMockContext();
      const result = jsonServerError(mockContext, 'Database connection failed');
      
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'server_error', message: 'Database connection failed' },
        500
      );
    });
  });
});
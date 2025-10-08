import { useState, useEffect, useCallback, useRef } from 'react';
import { ValidationResult, ValidationState, createValidationState, debounce } from '@/lib/validation';
import { validateFileUpload, validateResumeContent } from '@/lib/validation';

export type ValidatorFunction = (value: any) => ValidationResult;

interface UseValidationOptions {
  debounceMs?: number;
  validateOnMount?: boolean;
  validateOnChange?: boolean;
  immediate?: boolean;
}

export function useValidation<T = any>(
  value: T,
  validator: ValidatorFunction,
  options: UseValidationOptions = {}
) {
  const {
    debounceMs = 500,
    validateOnMount = false,
    validateOnChange = true,
    immediate = false,
  } = options;

  const [validationState, setValidationState] = useState<ValidationState>(createValidationState);
  const validationTimeoutRef = useRef<NodeJS.Timeout>();
  const lastValueRef = useRef<T>(value);

  // Immediate validation function
  const validate = useCallback(async (valueToValidate?: T): Promise<ValidationResult> => {
    const targetValue = valueToValidate !== undefined ? valueToValidate : value;
    let shouldUpdate = true;
    
    setValidationState(prev => {
      if (prev.isValidating) {
        shouldUpdate = false;
        return prev;
      }
      return { ...prev, isValidating: true };
    });
    
    if (!shouldUpdate) {
      return { isValid: false, errors: [], warnings: [], suggestions: [] };
    }

    try {
      const result = await Promise.resolve(validator(targetValue));
      
      setValidationState({
        isValidating: false,
        hasValidated: true,
        isValid: result.isValid,
        errors: result.errors || [],
        warnings: result.warnings || [],
        suggestions: result.suggestions || [],
        lastValidated: new Date(),
      });

      return result;
    } catch (error) {
      const errorResult: ValidationResult = {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation error'],
        warnings: [],
        suggestions: [],
      };

      setValidationState({
        isValidating: false,
        hasValidated: true,
        isValid: false,
        errors: errorResult.errors,
        warnings: [],
        suggestions: [],
        lastValidated: new Date(),
      });

      return errorResult;
    }
  }, [value, validator]);

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce((valueToValidate: T) => {
      validate(valueToValidate);
    }, debounceMs),
    [validate, debounceMs]
  );

  // Clear validation state
  const clearValidation = useCallback(() => {
    setValidationState(createValidationState());
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
  }, []);

  // Reset validation state
  const resetValidation = useCallback(() => {
    clearValidation();
    if (validateOnMount) {
      validate();
    }
  }, [clearValidation, validate, validateOnMount]);

  // Effect for value changes
  useEffect(() => {
    if (validateOnChange && lastValueRef.current !== value) {
      lastValueRef.current = value;
      
      if (immediate) {
        validate();
      } else {
        debouncedValidate(value);
      }
    }
  }, [value, validateOnChange, immediate, validate, debouncedValidate]);

  // Effect for initial validation
  useEffect(() => {
    if (validateOnMount) {
      if (immediate) {
        validate();
      } else {
        debouncedValidate(value);
      }
    }
  }, [validateOnMount, immediate, validate, debouncedValidate, value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...validationState,
    validate,
    clearValidation,
    resetValidation,
  };
}

// Specialized hooks for common validation scenarios
export function useFileValidation(files: FileList | null) {
  
  return useValidation(
    files,
    (files: FileList | null) => {
      if (!files) {
        return { isValid: true, errors: [], warnings: [], suggestions: [] };
      }
      return validateFileUpload(files);
    },
    { immediate: true, validateOnChange: true }
  );
}

export function useContentValidation(content: string) {
  
  return useValidation(
    content,
    validateResumeContent,
    { debounceMs: 1000, validateOnChange: true }
  );
}

export function useTechStackValidation(input: string) {
  const { validateTechStackInput } = require('@/lib/validation');
  
  return useValidation(
    input,
    validateTechStackInput,
    { debounceMs: 800, validateOnChange: true }
  );
}

// Form validation hook with multiple fields
export function useFormValidation<T extends Record<string, any>>(
  formData: T,
  validators: Record<keyof T, ValidatorFunction>
) {
  const [fieldStates, setFieldStates] = useState<Record<keyof T, ValidationState>>(() => {
    const initialState: Record<keyof T, ValidationState> = {} as any;
    Object.keys(validators).forEach(key => {
      initialState[key as keyof T] = createValidationState();
    });
    return initialState;
  });

  const [formState, setFormState] = useState({
    isValid: false,
    hasErrors: false,
    isValidating: false,
    touchedFields: new Set<keyof T>(),
  });

  // Validate a specific field
  const validateField = useCallback(async (fieldName: keyof T, value?: any): Promise<ValidationResult> => {
    const validator = validators[fieldName];
    if (!validator) {
      throw new Error(`No validator found for field: ${String(fieldName)}`);
    }

    const fieldValue = value !== undefined ? value : formData[fieldName];
    
    setFieldStates(prev => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], isValidating: true }
    }));

    try {
      const result = validator(fieldValue);
      
      setFieldStates(prev => ({
        ...prev,
        [fieldName]: {
          isValidating: false,
          hasValidated: true,
          isValid: result.isValid,
          errors: result.errors,
          warnings: result.warnings,
          suggestions: result.suggestions,
          lastValidated: new Date(),
        }
      }));

      return result;
    } catch (error) {
      const errorResult: ValidationResult = {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation error'],
        warnings: [],
        suggestions: [],
      };

      setFieldStates(prev => ({
        ...prev,
        [fieldName]: {
          isValidating: false,
          hasValidated: true,
          isValid: false,
          errors: errorResult.errors,
          warnings: [],
          suggestions: [],
          lastValidated: new Date(),
        }
      }));

      return errorResult;
    }
  }, [formData, validators]);

  // Validate all fields
  const validateAll = useCallback(async (): Promise<{ isValid: boolean; results: Record<keyof T, ValidationResult> }> => {
    const results: Record<keyof T, ValidationResult> = {} as any;
    
    setFormState(prev => ({ ...prev, isValidating: true }));

    const promises = Object.keys(validators).map(async (fieldName) => {
      const result = await validateField(fieldName as keyof T);
      results[fieldName as keyof T] = result;
      return result;
    });

    await Promise.all(promises);

    const isValid = Object.values(results).every((result: ValidationResult) => result.isValid);
    const hasErrors = Object.values(results).some((result: ValidationResult) => result.errors.length > 0);

    setFormState(prev => ({
      ...prev,
      isValidating: false,
      isValid,
      hasErrors,
    }));

    return { isValid, results };
  }, [validators, validateField]);

  // Mark field as touched
  const touchField = useCallback((fieldName: keyof T) => {
    setFormState(prev => ({
      ...prev,
      touchedFields: new Set(prev.touchedFields).add(fieldName),
    }));
  }, []);

  // Get validation state for a specific field
  const getFieldState = useCallback((fieldName: keyof T) => {
    return fieldStates[fieldName] || createValidationState();
  }, [fieldStates]);

  // Check if field should show validation (touched or has been validated)
  const shouldShowValidation = useCallback((fieldName: keyof T) => {
    const fieldState = getFieldState(fieldName);
    return formState.touchedFields.has(fieldName) || fieldState.hasValidated;
  }, [formState.touchedFields, getFieldState]);

  // Update form state when field states change
  useEffect(() => {
    const allFieldsValid = Object.values(fieldStates).every(state => 
      !state.hasValidated || state.isValid
    );
    const hasErrors = Object.values(fieldStates).some(state => 
      state.hasValidated && state.errors.length > 0
    );
    const isValidating = Object.values(fieldStates).some(state => state.isValidating);

    setFormState(prev => ({
      ...prev,
      isValid: allFieldsValid,
      hasErrors,
      isValidating,
    }));
  }, [fieldStates]);

  return {
    formState,
    fieldStates,
    validateField,
    validateAll,
    touchField,
    getFieldState,
    shouldShowValidation,
  };
}
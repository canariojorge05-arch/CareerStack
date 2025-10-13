import { useEffect } from 'react';
import { UseFormWatch, UseFormReset, FieldValues } from 'react-hook-form';

export function useFormPersistence<T extends FieldValues>(
  formId: string,
  watch: UseFormWatch<T>,
  reset: UseFormReset<T>,
  isDirty: boolean
) {
  // Load saved form data on mount
  useEffect(() => {
    const savedData = localStorage.getItem(`form_draft_${formId}`);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        reset(parsedData);
      } catch (error) {
        console.error('Error loading saved form data:', error);
      }
    }
  }, [formId, reset]);

  // Auto-save form data when it changes
  useEffect(() => {
    if (isDirty) {
      const saveTimeout = setTimeout(() => {
        const formData = watch();
        localStorage.setItem(`form_draft_${formId}`, JSON.stringify(formData));
      }, 1000);
      return () => clearTimeout(saveTimeout);
    }
  }, [watch, isDirty, formId]);

  const clearSavedData = () => {
    localStorage.removeItem(`form_draft_${formId}`);
  };

  return { clearSavedData };
}
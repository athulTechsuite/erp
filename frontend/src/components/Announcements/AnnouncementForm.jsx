import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Save, X, AlertCircle, Loader2 } from 'lucide-react';

// Error Boundary Component
class AnnouncementFormErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AnnouncementForm Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Something went wrong while loading the announcement form. Please refresh the page and try again.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => this.setState({ hasError: false, error: null })} 
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

const AnnouncementForm = ({ 
  announcement = null, 
  onSave, 
  onCancel, 
  isSubmitting = false 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(!!announcement);

  useEffect(() => {
    const initializeForm = async () => {
      if (announcement) {
        try {
          setIsInitializing(true);
          // Simulate async operation if needed (e.g., fetching additional data)
          await new Promise(resolve => setTimeout(resolve, 100));
          
          setFormData({
            title: DOMPurify.sanitize(announcement.title || ''),
            content: DOMPurify.sanitize(announcement.content || '')
          });
        } catch (error) {
          console.error('Error initializing form:', error);
          setErrors({ 
            initialization: 'Failed to load announcement data. Please try again.' 
          });
        } finally {
          setIsInitializing(false);
        }
      }
    };

    initializeForm();
  }, [announcement]);

  const validateField = (name, value) => {
    const fieldErrors = {};
    
    if (name === 'title') {
      if (!value.trim()) {
        fieldErrors.title = 'Title is required';
      } else if (value.length > 200) {
        fieldErrors.title = 'Title must be less than 200 characters';
      }
    }
    
    if (name === 'content') {
      if (!value.trim()) {
        fieldErrors.content = 'Content is required';
      } else if (value.length > 5000) {
        fieldErrors.content = 'Content must be less than 5000 characters';
      }
    }
    
    return fieldErrors;
  };

  const validateForm = () => {
    const titleErrors = validateField('title', formData.title);
    const contentErrors = validateField('content', formData.content);
    
    const allErrors = { ...titleErrors, ...contentErrors };
    setErrors(prev => ({ ...prev, ...allErrors }));
    
    return Object.keys(allErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear errors for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const fieldErrors = validateField(name, value);
    setErrors(prev => ({ ...prev, ...fieldErrors }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setTouched({ title: true, content: true });
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setErrors(prev => ({ ...prev, submit: undefined }));
      
      await onSave({
        ...formData,
        title: DOMPurify.sanitize(formData.title.trim()),
        content: DOMPurify.sanitize(formData.content.trim())
      });
    } catch (error) {
      console.error('Error saving announcement:', error);
      setErrors(prev => ({ 
        ...prev,
        submit: 'Failed to save announcement. Please try again.' 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ title: '', content: '' });
    setErrors({});
    setTouched({});
    onCancel();
  };

  const isFormDisabled = isSubmitting || isLoading || isInitializing;

  // Loading state for form initialization
  if (isInitializing) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Announcement...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
            <div className="flex justify-end gap-2">
              <div className="h-10 bg-gray-200 rounded w-20"></div>
              <div className="h-10 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {announcement ? 'Edit Announcement' : 'Create New Announcement'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.initialization && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{DOMPurify.sanitize(errors.initialization)}</AlertDescription>
            </Alert>
          )}
          
          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{DOMPurify.sanitize(errors.submit)}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Enter announcement title..."
              className={errors.title && touched.title ? 'border-red-500' : ''}
              maxLength={200}
              disabled={isFormDisabled}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {errors.title && touched.title && (
                  <span className="text-red-500">{DOMPurify.sanitize(errors.title)}</span>
                )}
              </span>
              <span>{formData.title.length}/200</span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium">
              Content <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Enter announcement content..."
              rows={8}
              className={errors.content && touched.content ? 'border-red-500' : ''}
              maxLength={5000}
              disabled={isFormDisabled}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {errors.content && touched.content && (
                  <span className="text-red-500">{DOMPurify.sanitize(errors.content)}</span>
                )}
              </span>
              <span>{formData.content.length}/5000</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isFormDisabled}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isFormDisabled || Object.keys(errors).filter(key => key !== 'initialization').length > 0}
            >
              {isLoading || isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isLoading || isSubmitting ? 'Saving...' : announcement ? 'Update' : 'Publish'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// Wrap the component with error boundary
const AnnouncementFormWithErrorBoundary = (props) => {
  return (
    <AnnouncementFormErrorBoundary>
      <AnnouncementForm {...props} />
    </AnnouncementFormErrorBoundary>
  );
};

export default AnnouncementFormWithErrorBoundary;
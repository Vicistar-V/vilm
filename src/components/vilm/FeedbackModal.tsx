import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useHaptics } from '@/hooks/useHaptics';
import { feedbackService } from '@/services/feedbackService';
import { toast } from '@/components/ui/sonner';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { selection, impact, notification } = useHaptics();

  const handleClose = async () => {
    await selection();
    setMessage('');
    setIsSuccess(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Please enter your feedback');
      await notification('error');
      return;
    }

    setIsSubmitting(true);
    await impact();

    try {
      const success = await feedbackService.submitFeedback(message);
      console.debug('Feedback submission result:', success);
      
      if (success) {
        setIsSuccess(true);
        await notification('success');
        toast.success('Thank you for your feedback!');
        
        // Auto-close after success
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast.error('Failed to send feedback. Please try again.');
      await notification('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ 
              type: 'spring',
              damping: 25,
              stiffness: 400
            }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50",
              "bg-vilm-surface rounded-t-3xl",
              "border-t border-vilm-border/50",
              "shadow-2xl max-h-[90vh]",
              "pb-safe-bottom"
            )}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-vilm-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-vilm-border/30">
              <h2 className="text-xl font-semibold text-vilm-text-primary">
                Send Feedback
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="text-vilm-text-secondary"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6">
              {!isSuccess ? (
                <div className="space-y-4">
                  <p className="text-sm text-vilm-text-secondary">
                    What's on your mind? Share your ideas, suggestions, or report any issues.
                  </p>
                  
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="I wish Vilm could..."
                    className={cn(
                      "min-h-[120px] resize-none",
                      "bg-background border-vilm-border",
                      "focus:border-vilm-primary focus:ring-1 focus:ring-vilm-primary",
                      "text-vilm-text-primary placeholder:text-vilm-text-tertiary"
                    )}
                    maxLength={500}
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-vilm-text-tertiary">
                      {message.length}/500
                    </span>
                    
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !message.trim()}
                      className={cn(
                        "bg-vilm-primary text-white",
                        "hover:bg-vilm-primary/90",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "min-w-[100px]"
                      )}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Send className="w-4 h-4" />
                          <span>Send</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-vilm-text-primary mb-2">
                    Thank you!
                  </h3>
                  <p className="text-vilm-text-secondary">
                    We've received your feedback and appreciate you taking the time to help us improve Vilm.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
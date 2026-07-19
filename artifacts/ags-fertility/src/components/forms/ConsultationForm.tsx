import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSubmitConsultation, ApiError } from '@workspace/api-client-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  treatment_interest: z.string().min(1, 'Please tell us which treatment interests you'),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function ConsultationForm() {
  const submitConsultation = useSubmitConsultation();
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [submittedName, setSubmittedName] = React.useState('');
  const [duplicateError, setDuplicateError] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState(false);
  const topRef = React.useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      treatment_interest: '',
      message: '',
    },
  });

  const onSubmit = (data: FormValues) => {
    setValidationError(null);
    setDuplicateError(false);
    setServerError(false);

    submitConsultation.mutate(
      {
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          treatment_interest: data.treatment_interest,
          message: data.message || undefined,
        },
      },
      {
        onSuccess: () => {
          setSubmittedName(data.name);
          setIsSuccess(true);
          form.reset();
          topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            const body = error.data as { success?: boolean; error?: string; message?: string } | null;

            if (error.status === 409 || body?.error === 'duplicate_lead') {
              setDuplicateError(true);
            } else if (error.status === 400) {
              setValidationError(body?.message || 'Please check your input and try again.');
            } else {
              setServerError(true);
            }
          } else {
            setServerError(true);
          }
        },
      },
    );
  };

  if (isSuccess) {
    return (
      <div ref={topRef} className="p-8 text-center bg-muted/30 rounded-2xl border border-border">
        <h3 className="text-2xl font-display font-semibold text-foreground mb-4">
          Thank you, {submittedName}.
        </h3>
        <p className="text-muted-foreground">
          We have received your consultation request. A member of our team will
          review your details and be in touch within one business day to discuss
          the next steps in your journey.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setIsSuccess(false)}
        >
          Submit another request
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name + Email row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="jane@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Phone + Treatment row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="treatment_interest"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Treatment Interest *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. IVF, Egg Freezing, Surrogacy, Donor Services"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Message */}
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Message (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us a little bit about your journey so far..."
                  className="min-h-[120px] resize-y"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Validation error (400) */}
        {validationError && (
          <div className="p-3 text-sm border border-amber-500/30 bg-amber-500/10 text-amber-400 rounded-md">
            {validationError}
          </div>
        )}

        {/* Duplicate error (409) */}
        {duplicateError && (
          <div className="p-3 text-sm border border-blue-500/30 bg-blue-500/10 text-blue-400 rounded-md">
            It looks like you already have an active consultation request. Our
            team will be in touch soon — no need to submit again.
          </div>
        )}

        {/* Server error (5xx / network) */}
        {serverError && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            Something went wrong on our end. Please try again in a moment, or
            contact us directly.
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={submitConsultation.isPending}
        >
          {submitConsultation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Request Consultation
        </Button>
      </form>
    </Form>
  );
}
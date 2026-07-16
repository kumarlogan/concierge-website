import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSubmitConsultation } from '@workspace/api-client-react';
import { ConsultationInputTreatmentInterest } from '@workspace/api-client-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  partnerName: z.string().optional(),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  province: z.string().min(1, 'Please select a province'),
  treatmentInterest: z.nativeEnum(ConsultationInputTreatmentInterest, {
    required_error: 'Please select a treatment of interest',
  }),
  howDidYouHear: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  consentToContact: z.boolean().refine((val) => val === true, {
    message: 'You must consent to be contacted',
  }),
});

type FormValues = z.infer<typeof formSchema>;

const provinces = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 
  'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 
  'Prince Edward Island', 'Quebec', 'Saskatchewan', 
  'Northwest Territories', 'Nunavut', 'Yukon'
];

export function ConsultationForm() {
  const submitConsultation = useSubmitConsultation();
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [submittedName, setSubmittedName] = React.useState('');
  const topRef = React.useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      partnerName: '',
      email: '',
      phone: '',
      province: '',
      howDidYouHear: '',
      message: '',
      consentToContact: false,
    },
  });

  const onSubmit = (data: FormValues) => {
    submitConsultation.mutate({
      data: {
        name: data.name,
        partnerName: data.partnerName || undefined,
        email: data.email,
        phone: data.phone || undefined,
        province: data.province,
        treatmentInterest: data.treatmentInterest,
        howDidYouHear: data.howDidYouHear || undefined,
        message: data.message,
        consentToContact: data.consentToContact,
      }
    }, {
      onSuccess: () => {
        setSubmittedName(data.name);
        setIsSuccess(true);
        form.reset();
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  if (isSuccess) {
    return (
      <div ref={topRef} className="p-8 text-center bg-muted/30 rounded-2xl border border-border">
        <h3 className="text-2xl font-display font-semibold text-foreground mb-4">
          Thank you, {submittedName}.
        </h3>
        <p className="text-muted-foreground">
          We have received your consultation request. A member of our team will review your details and be in touch within one business day to discuss the next steps in your journey.
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
            name="partnerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Partner Name (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone / WhatsApp (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Province / Territory *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your province" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {provinces.map((prov) => (
                      <SelectItem key={prov} value={prov}>
                        {prov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="treatmentInterest"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Treatment Interest *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select treatment" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(ConsultationInputTreatmentInterest).map((interest) => (
                      <SelectItem key={interest} value={interest}>
                        {interest}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="howDidYouHear"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How did you hear about us? (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Search, Word of Mouth, Social Media..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Message *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Please tell us a little bit about your journey so far..." 
                  className="min-h-[120px] resize-y"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="consentToContact"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal text-sm text-muted-foreground">
                  I consent to AGS Fertility Concierge processing my information and contacting me regarding my enquiry. I understand that AGS does not provide medical advice.
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {submitConsultation.isError && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            There was an error submitting your request. Please try again or contact us directly.
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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { requireRoleOrRedirect } from "@/lib/auth/guard";
import { getStoredUser } from "@/lib/auth/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { eventQueryOptions, upsertEvent } from "@/lib/data/events";
import { CATEGORIES } from "@/lib/format";
import { Navbar } from "@/components/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Trash2, ArrowLeft, AlertCircle } from "lucide-react";

const eventFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  category: z.string().min(1, "Please select a category"),
  date: z.string().min(1, "Please select a date"),
  venue: z.string().min(3, "Venue must be at least 3 characters"),
  city: z.string().min(3, "City must be at least 3 characters"),
  image: z.string().url("Please enter a valid image URL"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  featured: z.boolean(),
  tiers: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(2, "Tier name is required"),
        price: z.coerce.number().int().nonnegative("Price must be a positive number"),
        quantity_total: z.coerce.number().int().positive("Quantity must be a positive number"),
      }),
    )
    .min(1, "You must have at least one ticket tier."),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const eventSearchSchema = z.object({
  eventId: z.string().optional(),
});

export const Route = createFileRoute("/dashboard/form")({
  validateSearch: (search) => eventSearchSchema.parse(search),
  beforeLoad: ({ location }) => requireRoleOrRedirect(["organizer", "admin"], location.href),
  loaderDeps: ({ search: { eventId } }) => ({ eventId }),
  loader: ({ context, deps: { eventId } }) =>
    eventId ? context.queryClient.fetchQuery(eventQueryOptions(eventId)) : undefined,
  component: EventForm,
});

function EventForm() {
  const event = Route.useLoaderData();
  const navigate = useNavigate();
  const { eventId } = Route.useSearch();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      category: "",
      date: "",
      venue: "",
      city: "",
      image: "",
      description: "",
      featured: false,
      tiers: [{ name: "Regular", price: 0, quantity_total: 100 }],
    },
    values: event
      ? {
          id: event.id,
          title: event.title,
          category: event.category,
          date: new Date(event.date).toISOString().slice(0, 16),
          venue: event.venue,
          city: event.city,
          image: event.image,
          description: event.description,
          featured: event.featured,
          tiers: event.tiers,
        }
      : undefined,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tiers",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must be less than 5MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `events/${fileName}`;

      const { error } = await supabase.storage
        .from("event-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("event-images")
        .getPublicUrl(filePath);

      form.setValue("image", publicUrl, { shouldDirty: true, shouldValidate: true });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: EventFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const user = getStoredUser();
      const payload = {
        ...values,
        organizerId: (values.id ? event?.organizerId : user?.id) ?? undefined,
      };
      await upsertEvent({ data: payload });
      navigate({ to: "/dashboard" });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "An unknown error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
        </Button>
        <h1 className="text-2xl font-bold">{eventId ? "Edit Event" : "Create New Event"}</h1>

        <Card className="mt-6 p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Nyege Nyege Festival" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.filter(c => c !== "All").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="venue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Itanda Falls" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jinja" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="space-y-4 rounded-xl border p-4 bg-muted/10">
                <Label className="text-base">Event Cover Image</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="image-file" className="text-xs">Upload Cover Image</Label>
                    <Input
                      id="image-file"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading || isSubmitting}
                      className="cursor-pointer"
                    />
                    {uploading && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" /> Uploading image...
                      </div>
                    )}
                    {uploadError && (
                      <p className="text-xs font-medium text-destructive mt-1">{uploadError}</p>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="image"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs">Or Enter Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://your-image-url.com/image.png" {...field} disabled={uploading || isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {form.watch("image") && (
                  <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-lg border">
                    <img src={form.watch("image")} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Tell us more about your event..." className="min-h-32" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Ticket Tiers</h3>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid md:grid-cols-[1fr_120px_120px_auto] gap-4 items-start p-4 border rounded-lg">
                      <FormField
                        control={form.control}
                        name={`tiers.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tier Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. VIP" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`tiers.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price (UGX)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                             <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`tiers.${index}.quantity_total`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                             <FormMessage />
                          </FormItem>
                        )}
                      />
                       <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="mt-8"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ name: "", price: 0, quantity_total: 50 })}>
                  + Add Tier
                </Button>
                 {form.formState.errors.tiers && <p className="text-sm font-medium text-destructive mt-2">{form.formState.errors.tiers.message}</p>}
              </div>

             {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Something went wrong</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-4">
                <Button asChild variant="outline">
                  <Link to="/dashboard">Cancel</Link>
                </Button>
                 <Button type="submit" disabled={isSubmitting} className="bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Event"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}

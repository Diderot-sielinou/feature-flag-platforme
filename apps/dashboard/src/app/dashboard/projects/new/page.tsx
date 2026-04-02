'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FolderKanban,
  ArrowLeft,
  Save,
  Loader2,
  Globe,
  Plus,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { slugify } from '@/lib/utils';

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug is too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with dashes only'),
  description: z.string().max(500, 'Description is too long').optional(),
  environments: z.array(
    z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
    })
  ),
});

type ProjectForm = z.infer<typeof projectSchema>;

const defaultEnvironments = [
  { name: 'Development', slug: 'development' },
  { name: 'Staging', slug: 'staging' },
  { name: 'Production', slug: 'production' },
];

export default function NewProjectPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      environments: defaultEnvironments,
    },
  });

  const watchEnvironments = watch('environments');

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setValue('name', name);
    setValue('slug', slugify(name));
  };

  const handleAddEnvironment = () => {
    setValue('environments', [
      ...watchEnvironments,
      { name: '', slug: '' },
    ]);
  };

  const handleRemoveEnvironment = (index: number) => {
    setValue('environments', watchEnvironments.filter((_, i) => i !== index));
  };

  const handleEnvironmentChange = (index: number, field: 'name' | 'slug', value: string) => {
    const updated = watchEnvironments.map((env, i) => {
      if (i === index) {
        if (field === 'name') {
          return { ...env, name: value, slug: slugify(value) };
        }
        return { ...env, [field]: value };
      }
      return env;
    });
    setValue('environments', updated);
  };

  const onSubmit = async (data: ProjectForm) => {
    try {
      // API call would go here
      console.log('Creating project:', data);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated delay
      toast.success({
        title: 'Project created',
        description: `${data.name} has been created successfully`,
      });
      router.push('/dashboard/projects');
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold">Create Project</h1>
          <p className="text-muted-foreground">Set up a new project for your feature flags</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Basic information about your project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., E-commerce Platform"
                  {...register('name')}
                  onChange={handleNameChange}
                  error={!!errors.name}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Project Slug</Label>
                <Input
                  id="slug"
                  placeholder="e.g., ecommerce-platform"
                  className="font-mono"
                  {...register('slug')}
                  error={!!errors.slug}
                />
                {errors.slug && (
                  <p className="text-sm text-destructive">{errors.slug.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Used in URLs and API paths
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of your project"
                {...register('description')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Environments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Environments</CardTitle>
                <CardDescription>
                  Configure the environments for this project
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddEnvironment}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {watchEnvironments.map((env, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border"
                >
                  <div className="h-10 w-10 rounded-lg bg-tangerine/10 text-tangerine flex items-center justify-center">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="flex-1 grid gap-4 md:grid-cols-2">
                    <Input
                      placeholder="Environment name"
                      value={env.name}
                      onChange={(e) => handleEnvironmentChange(index, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Slug"
                      className="font-mono"
                      value={env.slug}
                      onChange={(e) => handleEnvironmentChange(index, 'slug', e.target.value)}
                    />
                  </div>
                  {watchEnvironments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEnvironment(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              You can add, remove, or rename environments later in project settings.
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/dashboard/projects">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="glow" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Create Project
              </>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

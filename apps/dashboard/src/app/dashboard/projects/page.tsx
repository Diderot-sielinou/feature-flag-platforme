'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  Plus,
  Search,
  MoreHorizontal,
  Flag,
  Users,
  Settings,
  Trash2,
  ExternalLink,
  Clock,
  Loader2, // Importé pour l'état de chargement
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Project } from '@/types';

// **[MIGRATION]** Importation du hook de React Query
import { useProjects } from '@/hooks/use-projects'; 
import { Skeleton } from '@/components/ui/skeleton'; // Importation du composant Skeleton pour le chargement

// **[MIGRATION]** L'ensemble des mockProjects est commenté/supprimé
/*
const mockProjects: (Project & { _count: { flags: number; environments: number; members: number } })[] = [
  // ... (contenu des mocks)
];
*/

const projectColors = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-tangerine to-amber',
  'from-green-500 to-emerald-500',
  'from-red-500 to-orange-500',
  'from-indigo-500 to-violet-500',
];

export default function ProjectsPage() {
  const [search, setSearch] = useState('');

  // **[MIGRATION]** Remplacement de l'état local par le hook d'API
  const { data: projectResponse, isLoading } = useProjects();
  
  // Extraction de la liste des projets (gère les cas undefined/null/données paginées)
  const projects = projectResponse?.data || [];

  // **[MIGRATION]** La liste filtrée utilise la liste provenant de l'API (projects)
  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Définition d'un squelette de chargement simple
  const LoadingSkeleton = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4 space-y-4">
          <Skeleton className="h-2 w-full" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex justify-between pt-4 border-t border-border">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your projects and their feature flags
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button variant="glow" className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* **[MIGRATION]** Affichage du Skeleton pendant le chargement */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* **[MIGRATION]** Assurez-vous que les données _count sont présentes pour ProjectCard */}
                <ProjectCard
                  project={project as ProjectCardProps['project']} 
                  colorClass={projectColors[index % projectColors.length]}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* **[MIGRATION]** Affichage de l'état vide uniquement si !isLoading */}
      {!isLoading && filteredProjects.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No projects found</h3>
          <p className="text-muted-foreground mb-4">
            {search
              ? 'Try adjusting your search'
              : 'Get started by creating your first project'}
          </p>
          {!search && (
            <Link href="/dashboard/projects/new">
              <Button variant="glow" className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </Link>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// L'interface ProjectCardProps reste inchangée, assumant que les données API incluent _count
interface ProjectCardProps {
  project: Project & { _count: { flags: number; environments: number; members: number } };
  colorClass: string;
}

function ProjectCard({ project, colorClass }: ProjectCardProps) {
  // Le reste du composant ProjectCard reste inchangé et utilise les données de 'project'
  return (
    <Card variant="interactive" className="group overflow-hidden">
      {/* Color Header */}
      <div className={cn('h-2 bg-gradient-to-r', colorClass)} />

      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-semibold',
                colorClass
              )}
            >
              {project.name.charAt(0)}
            </div>
            <div>
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="font-semibold hover:text-tangerine transition-colors"
              >
                {project.name}
              </Link>
              <p className="text-xs text-muted-foreground">{project.slug}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/projects/${project.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/projects/${project.id}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Flag className="h-4 w-4" />
            <span>{project._count.flags} flags</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{project._count.members} members</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {/* Team Avatars */}
          <div className="flex -space-x-2">
            {[1, 2, 3].slice(0, Math.min(project._count.members, 3)).map((i) => (
              <Avatar key={i} size="xs" className="border-2 border-card">
                <AvatarFallback className="text-[10px]">U{i}</AvatarFallback>
              </Avatar>
            ))}
            {project._count.members > 3 && (
              <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-medium">
                +{project._count.members - 3}
              </div>
            )}
          </div>

          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(project.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
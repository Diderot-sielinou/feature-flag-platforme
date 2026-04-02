'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, copyToClipboard } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language = 'typescript',
  title,
  showLineNumbers = false,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = code.split('\n');

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          {title && (
            <span className="text-xs text-muted-foreground font-mono ml-2">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{language}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            className="h-6 w-6"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Code */}
      <div className="bg-obsidian-400 overflow-x-auto">
        <pre className="p-4 text-sm font-mono">
          {showLineNumbers ? (
            <table className="w-full">
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className="pr-4 text-right text-muted-foreground select-none w-8">
                      {index + 1}
                    </td>
                    <td>
                      <code>{line}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <code>{code}</code>
          )}
        </pre>
      </div>
    </div>
  );
}

// Inline code component
interface InlineCodeProps {
  children: React.ReactNode;
  copyable?: boolean;
}

export function InlineCode({ children, copyable = false }: InlineCodeProps) {
  const handleCopy = async () => {
    if (typeof children === 'string') {
      await copyToClipboard(children);
      toast.success('Copied to clipboard');
    }
  };

  return (
    <code
      className={cn(
        'px-1.5 py-0.5 rounded bg-muted font-mono text-sm text-tangerine',
        copyable && 'cursor-pointer hover:bg-muted/80'
      )}
      onClick={copyable ? handleCopy : undefined}
    >
      {children}
    </code>
  );
}

export default CodeBlock;

"use client";

import { Tabs as Primitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Tabs = Primitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof Primitive.List>) {
  return <Primitive.List className={cn("inline-flex gap-1 overflow-x-auto rounded-md bg-sky-100/60 p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        "min-h-9 rounded-sm px-3 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = Primitive.Content;

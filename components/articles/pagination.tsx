"use client";

import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 pt-8">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="gap-1.5"
      >
        <LuChevronLeft className="size-4" />
        Previous
      </Button>

      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="gap-1.5"
      >
        Next
        <LuChevronRight className="size-4" />
      </Button>
    </div>
  );
}

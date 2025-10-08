-- Migration: add original_path column to resumes for filesystem-backed storage of original DOCX files
ALTER TABLE "resumes"
  ADD COLUMN IF NOT EXISTS "original_path" varchar;

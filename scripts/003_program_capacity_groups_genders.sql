-- Add gender support to program capacity groups
-- Run this in the Supabase SQL Editor after 002_program_capacity_groups.sql

ALTER TABLE public.program_capacity_groups
ADD COLUMN IF NOT EXISTS genders TEXT[] NOT NULL DEFAULT '{}';

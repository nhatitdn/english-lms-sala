-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "content_file_ids" UUID[] DEFAULT ARRAY[]::UUID[];

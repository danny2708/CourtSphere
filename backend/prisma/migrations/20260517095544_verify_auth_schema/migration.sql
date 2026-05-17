/*
  Warnings:

  - You are about to drop the column `booking_time_range` on the `bookings` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "bookings_time_range_idx";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "booking_time_range";

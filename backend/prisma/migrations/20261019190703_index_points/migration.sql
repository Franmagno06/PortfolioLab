-- CreateTable
CREATE TABLE "index_points" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "index_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "index_points_slug_date_key" ON "index_points"("slug", "date");
